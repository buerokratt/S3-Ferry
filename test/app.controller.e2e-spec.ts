import * as fs from 'fs';
import * as path from 'path';

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BlobServiceClient } from '@azure/storage-blob';
import {
  HttpStatus,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
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
import { s3ConfigFactory } from '../src/s3/config';
import { S3_DEFAULT_CONFIG_KEY } from '../src/s3/s3.constants';

describe('AppController (e2e)', () => {
  const S3_TEST_CONFIG_KEY = 'test';
  const S3_PAGINATION_CONFIG_KEY = 'pagination';
  const DEFAULT_FS_FIXTURE_FILE = 'default-root-file.txt';
  const TEST_FS_FIXTURE_FILE = 'test-root-file.txt';
  // Intentionally exceeds the first S3 ListObjectsV2 page so pagination is exercised later.
  const SHADOW_PAGINATION_TOTAL = 1111;
  let app: INestApplication;
  let defaultFsDataDirectoryPath: string;
  let testFsDataDirectoryPath: string;

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

  /**
   * The pagination e2e asserts the full bucket response, including `meta.count`.
   * Clearing the dedicated pagination bucket before and after the case keeps that
   * assertion deterministic and prevents leftover objects from previous runs.
   */
  async function deleteAllObjects(
    s3Client: S3Client,
    bucketName: string,
  ): Promise<void> {
    let continuationToken: string | undefined;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of response.Contents ?? []) {
        if (!object.Key) continue;
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: object.Key,
          }),
        );
      }

      continuationToken = response.NextContinuationToken;
      hasMorePages = Boolean(response.IsTruncated && continuationToken);
    }
  }

  /**
   * Seed more than one S3 listing page so the public `/v1/files` flow has to walk
   * continuation tokens instead of returning a single `listObjectsV2` page. The
   * generated names are deterministic, which makes the final equality assertion exact.
   */
  async function seedShadowPaginationObjects(
    s3Client: S3Client,
    bucketName: string,
    prefix: string,
  ): Promise<string[]> {
    const keys = Array.from(
      { length: SHADOW_PAGINATION_TOTAL },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      (_, index) => `${prefix}${String(index + 1).padStart(4, '0')}.txt`,
    );

    for (const key of keys) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Body: key,
          Key: key,
        }),
      );
    }

    return keys;
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

    const s3Config = app.get<ConfigType<typeof s3ConfigFactory>>(
      s3ConfigFactory.KEY,
    );
    defaultFsDataDirectoryPath =
      s3Config[S3_DEFAULT_CONFIG_KEY].fsDataDirectoryPath;
    testFsDataDirectoryPath = s3Config[S3_TEST_CONFIG_KEY].fsDataDirectoryPath;

    fs.mkdirSync(defaultFsDataDirectoryPath, { recursive: true });
    fs.mkdirSync(testFsDataDirectoryPath, { recursive: true });
    fs.writeFileSync(
      path.join(defaultFsDataDirectoryPath, DEFAULT_FS_FIXTURE_FILE),
      '',
    );
    fs.writeFileSync(path.join(defaultFsDataDirectoryPath, 'file.txt'), '');
    fs.writeFileSync(
      path.join(testFsDataDirectoryPath, TEST_FS_FIXTURE_FILE),
      '',
    );
  });

  afterAll(async () => {
    if (defaultFsDataDirectoryPath) {
      fs.rmSync(defaultFsDataDirectoryPath, { force: true, recursive: true });
    }
    if (testFsDataDirectoryPath) {
      fs.rmSync(testFsDataDirectoryPath, { force: true, recursive: true });
    }

    await app.close();
  });

  describe('GET /v1/files', () => {
    beforeAll(async () => {
      // Create S3 bucket(s) before running S3-related tests
      const s3Config = app.get<ConfigType<typeof s3ConfigFactory>>(
        s3ConfigFactory.KEY,
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/naming-convention
      for (const [_, config] of Object.entries(s3Config)) {
        const s3Client = new S3Client({
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          ...(config.endpointUrl && { endpoint: config.endpointUrl }),
          forcePathStyle: true,
          region: config.region,
        });

        await ensureS3BucketExists(s3Client, config.dataBucketName);
      }
    });

    it('should list files from the default local root when config key is omitted', async () => {
      const { body, status } = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.FS });

      expect(status).toBe(HttpStatus.OK);
      expect(body.meta.count).toBe(2);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'file.txt',
            lastModified: expect.any(String),
            size: 0,
          }),
          expect.objectContaining({
            name: DEFAULT_FS_FIXTURE_FILE,
            lastModified: expect.any(String),
            size: 0,
          }),
        ]),
      );
      expect(body.data).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: TEST_FS_FIXTURE_FILE,
          }),
        ]),
      );
    });

    it('should list files from the keyed local root when config key is provided for FS storage', async () => {
      const { body, status } = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.FS, configKey: S3_TEST_CONFIG_KEY });

      expect(status).toBe(HttpStatus.OK);
      expect(body.meta.count).toBe(1);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: TEST_FS_FIXTURE_FILE,
            lastModified: expect.any(String),
            size: 0,
          }),
        ]),
      );
      expect(body.data).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: DEFAULT_FS_FIXTURE_FILE,
          }),
          expect.objectContaining({
            name: 'file.txt',
          }),
        ]),
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
        .query({ type: StorageType.S3, configKey: S3_DEFAULT_CONFIG_KEY });
      expect(status).toBe(HttpStatus.OK);
      expect(body.meta.count).toBeGreaterThanOrEqual(1);
      expect(
        plainToInstance(
          FileDto,
          body.data.find((file: FileDto) => file.name === 'file.txt'),
        ),
      ).toEqual(
        expect.objectContaining({
          name: 'file.txt',
          lastModified: expect.any(String),
          size: 0,
        }),
      );
    });

    it(`should list ${SHADOW_PAGINATION_TOTAL} S3 files across shadow pagination`, async () => {
      const s3Config = app.get<ConfigType<typeof s3ConfigFactory>>(
        s3ConfigFactory.KEY,
      );
      const testS3Config = s3Config[S3_PAGINATION_CONFIG_KEY];
      const testPrefix = `pagination-file-${Date.now()}-${process.pid}-`;
      const s3Client = new S3Client({
        credentials: {
          accessKeyId: testS3Config.accessKeyId,
          secretAccessKey: testS3Config.secretAccessKey,
        },
        ...(testS3Config.endpointUrl && {
          endpoint: testS3Config.endpointUrl,
        }),
        forcePathStyle: true,
        region: testS3Config.region,
      });

      let seededKeys: string[] = [];

      try {
        await deleteAllObjects(s3Client, testS3Config.dataBucketName);
        seededKeys = await seedShadowPaginationObjects(
          s3Client,
          testS3Config.dataBucketName,
          testPrefix,
        );

        const { body, status } = await request(app.getHttpServer())
          .get('/v1/files')
          .query({
            type: StorageType.S3,
            configKey: S3_PAGINATION_CONFIG_KEY,
          });

        const seededFileNames = body.data
          .map((file: FileDto) => file.name)
          .sort((left: string, right: string) => left.localeCompare(right));

        expect(status).toBe(HttpStatus.OK);
        expect(seededFileNames).toEqual(seededKeys);
        expect(body.meta.count).toBe(SHADOW_PAGINATION_TOTAL);
      } finally {
        await deleteAllObjects(s3Client, testS3Config.dataBucketName);
      }
    });

    it('should keep default and test S3 configs isolated', async () => {
      const data: CopyFileBodyDto = {
        destinationFilePath: 'default-only-file.txt',
        destinationStorageType: StorageType.S3,
        sourceFilePath: 'file.txt',
        sourceStorageType: StorageType.FS,
      };

      await request(app.getHttpServer()).post('/v1/files/copy').send(data);

      const defaultResponse = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.S3, configKey: S3_DEFAULT_CONFIG_KEY });

      const testResponse = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.S3, configKey: S3_TEST_CONFIG_KEY });

      expect(defaultResponse.status).toBe(HttpStatus.OK);
      expect(testResponse.status).toBe(HttpStatus.OK);
      expect(defaultResponse.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'default-only-file.txt' }),
        ]),
      );
      expect(testResponse.body.data).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'default-only-file.txt' }),
        ]),
      );
    });

    it('should fail when "configKey" is provided for Azure storage', async () => {
      const { body, status } = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.AZURE, configKey: S3_DEFAULT_CONFIG_KEY });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        '"configKey" must be omitted when type is not FS or S3',
      ]);
    });

    it('should fail when invalid "configKey" is provided for S3 storage', async () => {
      const configKey = 'invalid-config-key';
      const { body, status } = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.S3, configKey });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toBe(`Invalid config key: "${configKey}"`);
    });

    it('should fail validation when "configKey" is empty for S3 storage', async () => {
      const { body, status } = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.S3, configKey: '' });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        '"configKey" must be a non-empty string when type is FS or S3',
      ]);
    });
  });

  describe('POST /v1/files/copy', () => {
    beforeAll(async () => {
      // Create S3 bucket(s) before running S3-related tests
      const s3Config = app.get<ConfigType<typeof s3ConfigFactory>>(
        s3ConfigFactory.KEY,
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/naming-convention
      for (const [_, config] of Object.entries(s3Config)) {
        const s3Client = new S3Client({
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          ...(config.endpointUrl && { endpoint: config.endpointUrl }),
          forcePathStyle: true,
          region: config.region,
        });

        await ensureS3BucketExists(s3Client, config.dataBucketName);
      }
    });

    it('should copy local file to the default S3 config when config key is omitted', async () => {
      const data: CopyFileBodyDto = {
        destinationFilePath: 'default-root-upload.txt',
        destinationStorageType: StorageType.S3,
        sourceFilePath: DEFAULT_FS_FIXTURE_FILE,
        sourceStorageType: StorageType.FS,
      };

      const { status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(data);

      expect(status).toBe(HttpStatus.CREATED);

      const { body, status: listStatus } = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.S3, configKey: S3_DEFAULT_CONFIG_KEY });

      expect(listStatus).toBe(HttpStatus.OK);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'default-root-upload.txt' }),
        ]),
      );
    });

    it('should copy remote file to the default local root when config key is omitted', async () => {
      const uploadData: CopyFileBodyDto = {
        destinationConfigKey: S3_DEFAULT_CONFIG_KEY,
        destinationFilePath: 'default-root-remote-source.txt',
        destinationStorageType: StorageType.S3,
        sourceFilePath: DEFAULT_FS_FIXTURE_FILE,
        sourceStorageType: StorageType.FS,
      };

      await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(uploadData);

      const data: CopyFileBodyDto = {
        destinationFilePath: 'downloaded-to-default-root.txt',
        destinationStorageType: StorageType.FS,
        sourceFilePath: 'default-root-remote-source.txt',
        sourceStorageType: StorageType.S3,
      };

      const { status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(data);

      expect(status).toBe(HttpStatus.CREATED);
      expect(
        fs.existsSync(
          path.join(
            defaultFsDataDirectoryPath,
            'downloaded-to-default-root.txt',
          ),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(testFsDataDirectoryPath, 'downloaded-to-default-root.txt'),
        ),
      ).toBe(false);
    });

    it('should copy local file from the explicit default local root to the test S3 config', async () => {
      const data: CopyFileBodyDto = {
        destinationConfigKey: S3_TEST_CONFIG_KEY,
        destinationFilePath: 'test-config-file.txt',
        destinationStorageType: StorageType.S3,
        sourceConfigKey: S3_DEFAULT_CONFIG_KEY,
        sourceFilePath: DEFAULT_FS_FIXTURE_FILE,
        sourceStorageType: StorageType.FS,
      };

      const { status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(data);

      expect(status).toBe(HttpStatus.CREATED);

      const { body, status: listStatus } = await request(app.getHttpServer())
        .get('/v1/files')
        .query({ type: StorageType.S3, configKey: S3_TEST_CONFIG_KEY });

      expect(listStatus).toBe(HttpStatus.OK);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'test-config-file.txt' }),
        ]),
      );
    });

    it('should copy remote file from the explicit test S3 config to the explicit default local root', async () => {
      const uploadData: CopyFileBodyDto = {
        destinationConfigKey: S3_TEST_CONFIG_KEY,
        destinationFilePath: 'test-remote-source.txt',
        destinationStorageType: StorageType.S3,
        sourceConfigKey: S3_DEFAULT_CONFIG_KEY,
        sourceFilePath: DEFAULT_FS_FIXTURE_FILE,
        sourceStorageType: StorageType.FS,
      };

      await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(uploadData);

      const downloadData: CopyFileBodyDto = {
        destinationConfigKey: S3_DEFAULT_CONFIG_KEY,
        destinationFilePath: 'downloaded-from-test.txt',
        destinationStorageType: StorageType.FS,
        sourceConfigKey: S3_TEST_CONFIG_KEY,
        sourceFilePath: 'test-remote-source.txt',
        sourceStorageType: StorageType.S3,
      };

      const { status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(downloadData);

      expect(status).toBe(HttpStatus.CREATED);
      expect(
        fs.existsSync(
          path.join(defaultFsDataDirectoryPath, 'downloaded-from-test.txt'),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(testFsDataDirectoryPath, 'downloaded-from-test.txt'),
        ),
      ).toBe(false);
    });

    it('should fail when invalid "destinationConfigKey" is provided for S3 copy', async () => {
      const configKey = 'missing';
      const data: CopyFileBodyDto = {
        destinationConfigKey: configKey,
        destinationFilePath: 'invalid-destination-config.txt',
        destinationStorageType: StorageType.S3,
        sourceFilePath: 'file.txt',
        sourceStorageType: StorageType.FS,
      };

      const { body, status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(data);

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toBe(`Invalid config key: "${configKey}"`);
    });

    it('should fail when invalid "sourceConfigKey" is provided for S3 copy', async () => {
      const configKey = 'missing';
      const data: CopyFileBodyDto = {
        destinationFilePath: 'invalid-source-config.txt',
        destinationStorageType: StorageType.FS,
        sourceConfigKey: configKey,
        sourceFilePath: 'file.txt',
        sourceStorageType: StorageType.S3,
      };

      const { body, status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(data);

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toBe(`Invalid config key: "${configKey}"`);
    });

    it('should fail when source and destination storage types are the same', async () => {
      const data: CopyFileBodyDto = {
        destinationFilePath: 'same-type-destination.txt',
        destinationStorageType: StorageType.S3,
        sourceFilePath: 'same-type-source.txt',
        sourceStorageType: StorageType.S3,
      };

      const { body, status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(data);

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        'destinationStorageType and sourceStorageType cannot have the same value',
      ]);
    });

    it('should fail validation when copy paths contain illegal characters', async () => {
      const data: CopyFileBodyDto = {
        destinationFilePath: 'safe.txt',
        destinationStorageType: StorageType.S3,
        sourceFilePath: '../unsafe.txt',
        sourceStorageType: StorageType.FS,
      };

      const { body, status } = await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(data);

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(['Path contains illegal characters']);
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

    it('should fail validation when create file paths contain illegal characters', async () => {
      const data: CreateFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-testaccount1',
            container: 'test-container',
            fileName: '../unsafe.json',
          },
        ],
        content: '[{"id":1}]',
      };

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/create')
        .send(data);

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        'files.0.Path contains illegal characters',
      ]);
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
        'delete-test-file.json',
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
        'delete-test-file.json',
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
      expect(body.message).toContain('nonexistent-file.json');
      expect(body.message).toContain('test-container');
      expect(body.message).toContain('azure-testaccount1');
    });

    it('should fail validation when delete file paths contain illegal characters', async () => {
      const data: DeleteFileBodyDto = {
        files: [
          {
            storageAccountId: 'azure-testaccount1',
            container: '../unsafe-container',
            fileName: 'test-file.json',
          },
        ],
      };

      const { status, body } = await request(app.getHttpServer())
        .delete('/v1/files/delete')
        .send(data);

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        'files.0.Path contains illegal characters',
      ]);
    });
  });

  describe('POST /v1/files/signed-url/download', () => {
    beforeAll(async () => {
      const s3Config = app.get<ConfigType<typeof s3ConfigFactory>>(
        s3ConfigFactory.KEY,
      );

      for (const config of Object.values(s3Config)) {
        const s3Client = new S3Client({
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          ...(config.endpointUrl && { endpoint: config.endpointUrl }),
          forcePathStyle: true,
          region: config.region,
        });

        await ensureS3BucketExists(s3Client, config.dataBucketName);
      }
    });

    it('should create a signed URL using the default S3 config when config key is omitted', async () => {
      const uploadData: CopyFileBodyDto = {
        destinationFilePath: 'signed-url-default-source.txt',
        destinationStorageType: StorageType.S3,
        sourceFilePath: DEFAULT_FS_FIXTURE_FILE,
        sourceStorageType: StorageType.FS,
      };

      await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(uploadData);

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-default-source.txt',
        });

      expect(status).toBe(HttpStatus.CREATED);
      expect(body).toEqual({ data: { url: expect.any(String) } });
      expect(body.data.url).toContain('signed-url-default-source.txt');
    });

    it('should create a signed URL using an explicit keyed S3 config', async () => {
      const uploadData: CopyFileBodyDto = {
        destinationConfigKey: S3_TEST_CONFIG_KEY,
        destinationFilePath: 'signed-url-keyed-source.txt',
        destinationStorageType: StorageType.S3,
        sourceConfigKey: S3_DEFAULT_CONFIG_KEY,
        sourceFilePath: DEFAULT_FS_FIXTURE_FILE,
        sourceStorageType: StorageType.FS,
      };

      await request(app.getHttpServer())
        .post('/v1/files/copy')
        .send(uploadData);

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-keyed-source.txt',
          configKey: S3_TEST_CONFIG_KEY,
        });

      expect(status).toBe(HttpStatus.CREATED);
      expect(body).toEqual({ data: { url: expect.any(String) } });
      expect(body.data.url).toContain('signed-url-keyed-source.txt');
    });

    it('should use the default expiry when expiresInSec is omitted', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-default-source.txt',
        });

      expect(status).toBe(HttpStatus.CREATED);
      expect(body.data.url).toContain('X-Amz-Expires=3600');
    });

    it('should honor a custom expiry when expiresInSec is provided', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-default-source.txt',
          expiresInSec: 60,
        });

      expect(status).toBe(HttpStatus.CREATED);
      expect(body.data.url).toContain('X-Amz-Expires=60');
    });

    it('should trim configKey before using the keyed S3 config', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-keyed-source.txt',
          configKey: `  ${S3_TEST_CONFIG_KEY}  `,
        });

      expect(status).toBe(HttpStatus.CREATED);
      expect(body).toEqual({ data: { url: expect.any(String) } });
      expect(body.data.url).toContain('signed-url-keyed-source.txt');
    });

    it('should fail when type is missing', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          filePath: 'signed-url-default-source.txt',
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(
        expect.arrayContaining([
          'type must be one of the following values: FS, S3, AZURE',
        ]),
      );
    });

    it('should fail when type is invalid', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: 'GCS',
          filePath: 'signed-url-default-source.txt',
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(
        expect.arrayContaining([
          'type must be one of the following values: FS, S3, AZURE',
        ]),
      );
    });

    it('should fail when filePath contains illegal path traversal characters', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: '../secret.txt',
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(['Path contains illegal characters']);
    });

    it.each([
      {
        name: 'zero expiry',
        expiresInSec: 0,
        expectedMessage: ['expiresInSec must not be less than 1'],
      },
      {
        name: 'negative expiry',
        expiresInSec: -1,
        expectedMessage: ['expiresInSec must not be less than 1'],
      },
      {
        name: 'fractional expiry',
        expiresInSec: 1.5,
        expectedMessage: ['expiresInSec must be an integer number'],
      },
    ])(
      'should fail when expiresInSec is invalid: $name',
      async ({ expiresInSec, expectedMessage }) => {
        const { body, status } = await request(app.getHttpServer())
          .post('/v1/files/signed-url/download')
          .send({
            type: StorageType.S3,
            filePath: 'signed-url-default-source.txt',
            expiresInSec,
          });

        expect(status).toBe(HttpStatus.BAD_REQUEST);
        expect(body.message).toEqual(expectedMessage);
      },
    );

    it('should fail when expiresInSec is a string', async () => {
      const { body, status } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-default-source.txt',
          expiresInSec: '60',
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        'expiresInSec must not be less than 1',
        'expiresInSec must be an integer number',
      ]);
    });

    it('should fail validation when configKey is empty for S3', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-default-source.txt',
          configKey: '',
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        '"configKey" must be a non-empty string when type is FS or S3',
      ]);
    });

    it('should fail validation when configKey is whitespace-only for S3', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-default-source.txt',
          configKey: '   ',
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        '"configKey" must be a non-empty string when type is FS or S3',
      ]);
    });

    it('should fail when an invalid S3 config key is provided', async () => {
      const configKey = 'invalid-config-key';

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-default-source.txt',
          configKey,
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toBe(`Invalid config key: "${configKey}"`);
    });

    it('should fail when the S3 object does not exist', async () => {
      const missingFilePath = 'missing-signed-url-source.txt';

      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.S3,
          filePath: missingFilePath,
        });

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body.message).toBe('File not found in S3');
    });

    it('should fail with an internal server error for FS storage type', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.FS,
          filePath: 'signed-url-default-source.txt',
        });

      expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.message).toBe('Internal server error');
    });

    it('should fail with an internal server error for AZURE storage type when configKey is omitted', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.AZURE,
          filePath: 'signed-url-default-source.txt',
        });

      expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.message).toBe('Internal server error');
    });

    it('should fail validation when configKey is provided for AZURE storage', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/download')
        .send({
          type: StorageType.AZURE,
          filePath: 'signed-url-default-source.txt',
          configKey: S3_DEFAULT_CONFIG_KEY,
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        '"configKey" must be omitted when type is not FS or S3',
      ]);
    });
  });

  describe('POST /v1/files/signed-url/upload', () => {
    beforeAll(async () => {
      const s3Config = app.get<ConfigType<typeof s3ConfigFactory>>(
        s3ConfigFactory.KEY,
      );

      for (const config of Object.values(s3Config)) {
        const s3Client = new S3Client({
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          ...(config.endpointUrl && { endpoint: config.endpointUrl }),
          forcePathStyle: true,
          region: config.region,
        });

        await ensureS3BucketExists(s3Client, config.dataBucketName);
      }
    });

    it('should create a signed upload URL using the default S3 config when config key is omitted', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/upload')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-upload-default-target.txt',
        });

      expect(status).toBe(HttpStatus.CREATED);
      expect(body).toEqual({ data: { url: expect.any(String) } });
      expect(body.data.url).toContain('signed-url-upload-default-target.txt');
      expect(body.data.url).toContain('X-Amz-Expires=3600');
    });

    it('should create a signed upload URL using an explicit keyed S3 config', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/upload')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-upload-keyed-target.txt',
          configKey: S3_TEST_CONFIG_KEY,
          expiresInSec: 60,
        });

      expect(status).toBe(HttpStatus.CREATED);
      expect(body).toEqual({ data: { url: expect.any(String) } });
      expect(body.data.url).toContain('signed-url-upload-keyed-target.txt');
      expect(body.data.url).toContain('X-Amz-Expires=60');
    });

    it('should include upload metadata in the signed URL when provided', async () => {
      const filePath = 'signed-url-upload-metadata-target.txt';
      const contentDisposition =
        "attachment; filename*=UTF-8''report%20final.txt";
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/upload')
        .send({
          type: StorageType.S3,
          filePath,
          fileName: 'report final.txt',
          mimeType: 'text/plain',
        });

      expect(status).toBe(HttpStatus.CREATED);
      expect(body).toEqual({ data: { url: expect.any(String) } });
      expect(body.data.url).toContain(filePath);
      expect(decodeURIComponent(body.data.url)).toContain(
        'X-Amz-SignedHeaders=content-disposition;host',
      );

      const uploadResponse = await fetch(body.data.url, {
        method: 'PUT',
        body: 'uploaded through signed url',
        headers: {
          'Content-Disposition': contentDisposition,
          'Content-Type': 'text/plain',
        },
      });

      expect(uploadResponse.status).toBe(HttpStatus.OK);

      const s3Config = app.get<ConfigType<typeof s3ConfigFactory>>(
        s3ConfigFactory.KEY,
      );
      const defaultS3Config = s3Config[S3_DEFAULT_CONFIG_KEY];
      const s3Client = new S3Client({
        credentials: {
          accessKeyId: defaultS3Config.accessKeyId,
          secretAccessKey: defaultS3Config.secretAccessKey,
        },
        ...(defaultS3Config.endpointUrl && {
          endpoint: defaultS3Config.endpointUrl,
        }),
        forcePathStyle: true,
        region: defaultS3Config.region,
      });
      const uploadedObject = await s3Client.send(
        new HeadObjectCommand({
          Bucket: defaultS3Config.dataBucketName,
          Key: filePath,
        }),
      );

      expect(uploadedObject.ContentDisposition).toBe(contentDisposition);
      expect(uploadedObject.ContentType).toBe('text/plain');
    });

    it('should trim configKey before using the keyed S3 config', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/upload')
        .send({
          type: StorageType.S3,
          filePath: 'signed-url-upload-trimmed-key-target.txt',
          configKey: `  ${S3_TEST_CONFIG_KEY}  `,
        });

      expect(status).toBe(HttpStatus.CREATED);
      expect(body).toEqual({ data: { url: expect.any(String) } });
      expect(body.data.url).toContain(
        'signed-url-upload-trimmed-key-target.txt',
      );
    });

    it('should fail when filePath contains illegal path traversal characters', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/upload')
        .send({
          type: StorageType.S3,
          filePath: '../secret.txt',
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(['Path contains illegal characters']);
    });

    it.each([
      {
        name: 'zero expiry',
        expiresInSec: 0,
        expectedMessage: ['expiresInSec must not be less than 1'],
      },
      {
        name: 'negative expiry',
        expiresInSec: -1,
        expectedMessage: ['expiresInSec must not be less than 1'],
      },
      {
        name: 'fractional expiry',
        expiresInSec: 1.5,
        expectedMessage: ['expiresInSec must be an integer number'],
      },
    ])(
      'should fail when expiresInSec is invalid: $name',
      async ({ expiresInSec, expectedMessage }) => {
        const { body, status } = await request(app.getHttpServer())
          .post('/v1/files/signed-url/upload')
          .send({
            type: StorageType.S3,
            filePath: 'signed-url-upload-target.txt',
            expiresInSec,
          });

        expect(status).toBe(HttpStatus.BAD_REQUEST);
        expect(body.message).toEqual(expectedMessage);
      },
    );

    it('should fail validation when configKey is provided for AZURE storage', async () => {
      const { status, body } = await request(app.getHttpServer())
        .post('/v1/files/signed-url/upload')
        .send({
          type: StorageType.AZURE,
          filePath: 'signed-url-upload-target.txt',
          configKey: S3_DEFAULT_CONFIG_KEY,
        });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual([
        '"configKey" must be omitted when type is not FS or S3',
      ]);
    });
  });
});
