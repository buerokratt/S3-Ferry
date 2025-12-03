import * as fs from 'fs';
import * as path from 'path';

import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BlobServiceClient } from '@azure/storage-blob';
import {
  HttpStatus,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  CopyFileBodyDto,
  CreateFileBodyDto,
  DeleteFileBodyDto,
  FileDto,
  StorageAccountDto,
} from '../src/common/dtos';
import { StorageType } from '../src/common/enums';
import { fsConfigFactory } from '../src/fs/config';
import { s3ConfigFactory } from '../src/s3/config';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let fsDataDirectoryPath: string;

  /**
   * Helper function to ensure an S3 bucket exists.
   * Creates the bucket if it doesn't exist.
   */
  async function ensureS3BucketExists(
    s3Client: S3Client,
    bucketName: string,
  ): Promise<void> {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      } else {
        throw error;
      }
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );

    await app.init();

    fsDataDirectoryPath = app.get(fsConfigFactory.KEY).dataDirectoryPath;

    fs.mkdirSync(fsDataDirectoryPath, { recursive: true });
    fs.writeFileSync(path.join(fsDataDirectoryPath, 'file.txt'), '');
  });

  afterAll(async () => {
    if (fsDataDirectoryPath) {
      fs.rmSync(fsDataDirectoryPath, { recursive: true });
    }

    await app.close();
  });

  describe('GET /v1/files', () => {
    beforeAll(async () => {
      // Create S3 bucket before running S3-related tests
      const s3Config = app.get(s3ConfigFactory.KEY);
      const s3Client = new S3Client({
        credentials: {
          accessKeyId: s3Config.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey,
        },
        ...(s3Config.endpointUrl && { endpoint: s3Config.endpointUrl }),
        forcePathStyle: true,
        region: s3Config.region,
      });

      await ensureS3BucketExists(s3Client, s3Config.dataBucketName);
    });

    it('should list local files', async () => {
      const { body, status } = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.FS });

      expect(status).toBe(HttpStatus.OK);
      expect(body.meta.count).toBe(1);
      expect(plainToInstance(FileDto, body.data[0])).toEqual(
        expect.objectContaining({
          name: 'file.txt',
          lastModified: expect.any(String),
          size: 0,
        }),
      );
    });

    it('should list remote files', async () => {
      const data: CopyFileBodyDto = {
        destinationFilePath: 'file.txt',
        destinationStorageType: StorageType.S3,
        sourceFilePath: 'file.txt',
        sourceStorageType: StorageType.FS,
      };

      await request(app.getHttpServer()).post('/v1/files/copy').send(data);

      const { body, status } = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.S3 });

      expect(status).toBe(HttpStatus.OK);
      expect(body.meta.count).toBe(1);
      expect(plainToInstance(FileDto, body.data[0])).toEqual(
        expect.objectContaining({
          name: 'file.txt',
          lastModified: expect.any(String),
          size: 0,
        }),
      );
    });
  });

  describe('POST /v1/files/copy', () => {
    beforeAll(async () => {
      // Create S3 bucket before running S3-related tests
      const s3Config = app.get(s3ConfigFactory.KEY);
      const s3Client = new S3Client({
        credentials: {
          accessKeyId: s3Config.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey,
        },
        ...(s3Config.endpointUrl && { endpoint: s3Config.endpointUrl }),
        forcePathStyle: true,
        region: s3Config.region,
      });

      await ensureS3BucketExists(s3Client, s3Config.dataBucketName);
    });

    it('should copy local file to remote', async () => {
      const data: CopyFileBodyDto = {
        destinationFilePath: 'file.txt',
        destinationStorageType: StorageType.S3,
        sourceFilePath: 'file.txt',
        sourceStorageType: StorageType.FS,
      };

      const { status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(data);

      expect(status).toBe(HttpStatus.CREATED);
    });

    it('should copy remote file to local', async () => {
      const data: CopyFileBodyDto = {
        destinationFilePath: 'file.txt',
        destinationStorageType: StorageType.FS,
        sourceFilePath: 'file.txt',
        sourceStorageType: StorageType.S3,
      };

      const { status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(data);

      expect(status).toBe(HttpStatus.CREATED);
    });
  });

  describe('GET /v1/storage-accounts', () => {
    it('should return accounts with IDs based on AccountName', async () => {
      const { body, status } = await request(app.getHttpServer()).get(
        '/v1/storage-accounts',
      );

      expect(status).toBe(HttpStatus.OK);

      // Based on test.env, we should have accounts with IDs like:
      // azure-testaccount1, azure-testaccount2, azure-testaccount3
      const accountIds = body.map((account: StorageAccountDto) => account.id);

      // Verify IDs follow the pattern azure-{accountname}
      accountIds.forEach((id: string) => {
        expect(id).toMatch(/^azure-[a-z0-9-]+$/);
      });

      // Verify we have the expected number of accounts (3 from test.env)
      expect(accountIds.length).toBe(3);

      // Verify specific account IDs exist
      expect(accountIds).toContain('azure-testaccount1');
      expect(accountIds).toContain('azure-testaccount2');
      expect(accountIds).toContain('azure-testaccount3');
    });
  });

  describe('POST /v1/files/create', () => {
    /**
     * Helper function to ensure an Azure container exists.
     * Creates the container if it doesn't exist.
     */
    async function ensureAzureContainerExists(
      connectionString: string,
      containerName: string,
    ): Promise<void> {
      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();
    }

    beforeAll(async () => {
      // Create test-container in all three test accounts before running tests
      const azuriteHost = process.env.AZURITE_HOST || '127.0.0.1';
      const account1ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount1;AccountKey=dGVzdGtleTE9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount1;QueueEndpoint=http://${azuriteHost}:10001/testaccount1;TableEndpoint=http://${azuriteHost}:10002/testaccount1;`;
      const account2ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount2;AccountKey=dGVzdGtleTI9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount2;QueueEndpoint=http://${azuriteHost}:10001/testaccount2;TableEndpoint=http://${azuriteHost}:10002/testaccount2;`;
      const account3ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount3;AccountKey=dGVzdGtleTM9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount3;QueueEndpoint=http://${azuriteHost}:10001/testaccount3;TableEndpoint=http://${azuriteHost}:10002/testaccount3;`;

      await Promise.all([
        ensureAzureContainerExists(account1ConnectionString, 'test-container'),
        ensureAzureContainerExists(account2ConnectionString, 'test-container'),
        ensureAzureContainerExists(account3ConnectionString, 'test-container'),
      ]);
    });

    it('should create a file in Azure storage', async () => {
      const data: CreateFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-testaccount1',
            container: 'test-container',
            fileName: '77eadbf3-cff9-4b11-b8de-46f37a029fd8.json',
          },
        ],
        content: '[{"id":1,"name":"item1"},{"id":2,"name":"item2"}]',
      };

      const { status } = await request(app.getHttpServer())
        .post('/v1/files/create')
        .send(data);

      expect(status).toBe(HttpStatus.CREATED);
    });

    it('should create multiple files in parallel', async () => {
      const data: CreateFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-testaccount1',
            container: 'test-container',
            fileName: 'file1.json',
          },
          {
            storageAccountId: 'azure-testaccount2',
            container: 'test-container',
            fileName: 'file2.json',
          },
          {
            storageAccountId: 'azure-testaccount3',
            container: 'test-container',
            fileName: 'file3.json',
          },
        ],
        content: '[{"id":1,"name":"item1"},{"id":2,"name":"item2"}]',
      };

      const { status } = await request(app.getHttpServer())
        .post('/v1/files/create')
        .send(data);

      expect(status).toBe(HttpStatus.CREATED);

      // Verify files were created in the correct accounts
      // Use connection strings from environment (works in both local and CI)
      const azuriteHost = process.env.AZURITE_HOST || '127.0.0.1';
      const account1ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount1;AccountKey=dGVzdGtleTE9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount1;QueueEndpoint=http://${azuriteHost}:10001/testaccount1;TableEndpoint=http://${azuriteHost}:10002/testaccount1;`;
      const account2ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount2;AccountKey=dGVzdGtleTI9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount2;QueueEndpoint=http://${azuriteHost}:10001/testaccount2;TableEndpoint=http://${azuriteHost}:10002/testaccount2;`;
      const account3ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount3;AccountKey=dGVzdGtleTM9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount3;QueueEndpoint=http://${azuriteHost}:10001/testaccount3;TableEndpoint=http://${azuriteHost}:10002/testaccount3;`;

      // Check account 1
      const blobServiceClient1 = BlobServiceClient.fromConnectionString(
        account1ConnectionString,
      );
      const containerClient1 =
        blobServiceClient1.getContainerClient('test-container');
      const blobs1: string[] = [];
      for await (const blob of containerClient1.listBlobsFlat()) {
        blobs1.push(blob.name);
      }
      expect(blobs1).toContain('file1.json');
      expect(blobs1).not.toContain('file2.json');
      expect(blobs1).not.toContain('file3.json');

      // Check account 2
      const blobServiceClient2 = BlobServiceClient.fromConnectionString(
        account2ConnectionString,
      );
      const containerClient2 =
        blobServiceClient2.getContainerClient('test-container');
      const blobs2: string[] = [];
      for await (const blob of containerClient2.listBlobsFlat()) {
        blobs2.push(blob.name);
      }
      expect(blobs2).toContain('file2.json');
      expect(blobs2).not.toContain('file1.json');
      expect(blobs2).not.toContain('file3.json');

      // Check account 3
      const blobServiceClient3 = BlobServiceClient.fromConnectionString(
        account3ConnectionString,
      );
      const containerClient3 =
        blobServiceClient3.getContainerClient('test-container');
      const blobs3: string[] = [];
      for await (const blob of containerClient3.listBlobsFlat()) {
        blobs3.push(blob.name);
      }
      expect(blobs3).toContain('file3.json');
      expect(blobs3).not.toContain('file1.json');
      expect(blobs3).not.toContain('file2.json');
    });

    it('should fail with invalid storage account ID', async () => {
      const data: CreateFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-nonexistent-account',
            container: 'test-container',
            fileName: 'test-file.json',
          },
        ],
        content: '[{"id":1,"name":"item1"},{"id":2,"name":"item2"}]',
      };

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/create')
        .send(data);

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body.message).toContain('Storage account not found');
      expect(body.message).toContain('azure-nonexistent-account');
    });

    it('should fail with unsupported storage type', async () => {
      const data: CreateFileBodyDto = {
        files: [
          {
            storageAccountId: 's3-invalid-account',
            container: 'test-container',
            fileName: 'test-file.json',
          },
        ],
        content: '[{"id":1,"name":"item1"},{"id":2,"name":"item2"}]',
      };

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/create')
        .send(data);

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toContain('Storage type not supported');
      expect(body.message).toContain('s3-invalid-account');
    });

    it('should fail when container does not exist', async () => {
      const data: CreateFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-testaccount1',
            container: 'nonexistent-container',
            fileName: 'test-file.json',
          },
        ],
        content: '[{"id":1,"name":"item1"},{"id":2,"name":"item2"}]',
      };

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/create')
        .send(data);

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body.message).toContain('Container not found');
      expect(body.message).toContain('nonexistent-container');
      expect(body.message).toContain('azure-testaccount1');
    });
  });

  describe('DELETE /v1/files/delete', () => {
    /**
     * Helper function to ensure an Azure container exists.
     * Creates the container if it doesn't exist.
     */
    async function ensureAzureContainerExists(
      connectionString: string,
      containerName: string,
    ): Promise<void> {
      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();
    }

    /**
     * Helper function to create a blob in Azure storage.
     */
    async function createBlob(
      connectionString: string,
      containerName: string,
      blobName: string,
      content: string,
    ): Promise<void> {
      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const contentBuffer = Buffer.from(content, 'utf-8');
      await blockBlobClient.upload(contentBuffer, contentBuffer.length);
    }

    beforeAll(async () => {
      // Create test-container in all three test accounts before running tests
      const azuriteHost = process.env.AZURITE_HOST || '127.0.0.1';
      const account1ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount1;AccountKey=dGVzdGtleTE9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount1;QueueEndpoint=http://${azuriteHost}:10001/testaccount1;TableEndpoint=http://${azuriteHost}:10002/testaccount1;`;
      const account2ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount2;AccountKey=dGVzdGtleTI9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount2;QueueEndpoint=http://${azuriteHost}:10001/testaccount2;TableEndpoint=http://${azuriteHost}:10002/testaccount2;`;
      const account3ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount3;AccountKey=dGVzdGtleTM9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount3;QueueEndpoint=http://${azuriteHost}:10001/testaccount3;TableEndpoint=http://${azuriteHost}:10002/testaccount3;`;

      await Promise.all([
        ensureAzureContainerExists(account1ConnectionString, 'test-container'),
        ensureAzureContainerExists(account2ConnectionString, 'test-container'),
        ensureAzureContainerExists(account3ConnectionString, 'test-container'),
      ]);
    });

    it('should delete a file from Azure storage', async () => {
      // First, create a file to delete
      const azuriteHost = process.env.AZURITE_HOST || '127.0.0.1';
      const account1ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount1;AccountKey=dGVzdGtleTE9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount1;QueueEndpoint=http://${azuriteHost}:10001/testaccount1;TableEndpoint=http://${azuriteHost}:10002/testaccount1;`;
      await createBlob(
        account1ConnectionString,
        'test-container',
        'delete-test-file.txt',
        '[{"id":1,"name":"item1"},{"id":2,"name":"item2"}]',
      );

      const data: DeleteFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-testaccount1',
            container: 'test-container',
            fileName: 'delete-test-file.json',
          },
        ],
      };

      const { status } = await request(app.getHttpServer())
        .delete('/v1/files/delete')
        .send(data);

      expect(status).toBe(HttpStatus.OK);

      // Verify the file was actually deleted
      const blobServiceClient = BlobServiceClient.fromConnectionString(
        account1ConnectionString,
      );
      const containerClient =
        blobServiceClient.getContainerClient('test-container');
      const blockBlobClient = containerClient.getBlockBlobClient(
        'delete-test-file.txt',
      );
      const exists = await blockBlobClient.exists();
      expect(exists).toBe(false);
    });

    it('should delete multiple files in parallel', async () => {
      // First, create files to delete
      const azuriteHost = process.env.AZURITE_HOST || '127.0.0.1';
      const account1ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount1;AccountKey=dGVzdGtleTE9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount1;QueueEndpoint=http://${azuriteHost}:10001/testaccount1;TableEndpoint=http://${azuriteHost}:10002/testaccount1;`;
      const account2ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount2;AccountKey=dGVzdGtleTI9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount2;QueueEndpoint=http://${azuriteHost}:10001/testaccount2;TableEndpoint=http://${azuriteHost}:10002/testaccount2;`;
      const account3ConnectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount3;AccountKey=dGVzdGtleTM9PQ==;BlobEndpoint=http://${azuriteHost}:10000/testaccount3;QueueEndpoint=http://${azuriteHost}:10001/testaccount3;TableEndpoint=http://${azuriteHost}:10002/testaccount3;`;

      await Promise.all([
        createBlob(
          account1ConnectionString,
          'test-container',
          'parallel-delete-file1.json',
          '[{"id":1,"name":"item1"},{"id":2,"name":"item2"}]',
        ),
        createBlob(
          account2ConnectionString,
          'test-container',
          'parallel-delete-file2.json',
          '[{"id":1,"name":"item1"},{"id":2,"name":"item2"}]',
        ),
        createBlob(
          account3ConnectionString,
          'test-container',
          'parallel-delete-file3.json',
          '[{"id":1,"name":"item1"},{"id":2,"name":"item2"}]',
        ),
      ]);

      const data: DeleteFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-testaccount1',
            container: 'test-container',
            fileName: 'parallel-delete-file1.json',
          },
          {
            storageAccountId: 'azure-testaccount2',
            container: 'test-container',
            fileName: 'parallel-delete-file2.json',
          },
          {
            storageAccountId: 'azure-testaccount3',
            container: 'test-container',
            fileName: 'parallel-delete-file3.json',
          },
        ],
      };

      const { status } = await request(app.getHttpServer())
        .delete('/v1/files/delete')
        .send(data);

      expect(status).toBe(HttpStatus.OK);

      // Verify all files were deleted
      const blobServiceClient1 = BlobServiceClient.fromConnectionString(
        account1ConnectionString,
      );
      const containerClient1 =
        blobServiceClient1.getContainerClient('test-container');
      const blockBlobClient1 = containerClient1.getBlockBlobClient(
        'parallel-delete-file1.json',
      );
      expect(await blockBlobClient1.exists()).toBe(false);

      const blobServiceClient2 = BlobServiceClient.fromConnectionString(
        account2ConnectionString,
      );
      const containerClient2 =
        blobServiceClient2.getContainerClient('test-container');
      const blockBlobClient2 = containerClient2.getBlockBlobClient(
        'parallel-delete-file2.json',
      );
      expect(await blockBlobClient2.exists()).toBe(false);

      const blobServiceClient3 = BlobServiceClient.fromConnectionString(
        account3ConnectionString,
      );
      const containerClient3 =
        blobServiceClient3.getContainerClient('test-container');
      const blockBlobClient3 = containerClient3.getBlockBlobClient(
        'parallel-delete-file3.json',
      );
      expect(await blockBlobClient3.exists()).toBe(false);
    });

    it('should fail with invalid storage account ID', async () => {
      const data: DeleteFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-nonexistent-account',
            container: 'test-container',
            fileName: 'test-file.json',
          },
        ],
      };

      const { status, body } = await request(app.getHttpServer())
        .delete('/v1/files/delete')
        .send(data);

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body.message).toContain('Storage account not found');
      expect(body.message).toContain('azure-nonexistent-account');
    });

    it('should fail with unsupported storage type', async () => {
      const data: DeleteFileBodyDto = {
        files: [
          {
            storageAccountId: 's3-invalid-account',
            container: 'test-container',
            fileName: 'test-file.json',
          },
        ],
      };

      const { status, body } = await request(app.getHttpServer())
        .delete('/v1/files/delete')
        .send(data);

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toContain('Storage type not supported');
      expect(body.message).toContain('s3-invalid-account');
    });

    it('should fail when container does not exist', async () => {
      const data: DeleteFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-testaccount1',
            container: 'nonexistent-container',
            fileName: 'test-file.json',
          },
        ],
      };

      const { status, body } = await request(app.getHttpServer())
        .delete('/v1/files/delete')
        .send(data);

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body.message).toContain('Container not found');
      expect(body.message).toContain('nonexistent-container');
      expect(body.message).toContain('azure-testaccount1');
    });

    it('should fail when blob does not exist', async () => {
      const data: DeleteFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-testaccount1',
            container: 'test-container',
            fileName: 'nonexistent-file.json',
          },
        ],
      };

      const { status, body } = await request(app.getHttpServer())
        .delete('/v1/files/delete')
        .send(data);

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body.message).toContain('Blob not found');
      expect(body.message).toContain('nonexistent-file.txt');
      expect(body.message).toContain('test-container');
      expect(body.message).toContain('azure-testaccount1');
    });
  });
});
