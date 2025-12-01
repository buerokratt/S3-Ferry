import * as fs from 'fs';
import * as path from 'path';

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
  FileDto,
  StorageAccountDto,
} from '../src/common/dtos';
import { StorageType } from '../src/common/enums';
import { fsConfigFactory } from '../src/fs/config';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let fsDataDirectoryPath: string;

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
});
