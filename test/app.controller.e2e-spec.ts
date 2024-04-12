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
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { appConfigFactory } from '../src/config';
import { CopyFileBodyDto, FileDto } from '../src/dtos';
import { StorageType } from '../src/enums';

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

    fsDataDirectoryPath = app.get(appConfigFactory.KEY).fsDataDirectoryPath;

    fs.mkdirSync(fsDataDirectoryPath);
    fs.writeFileSync(path.join(fsDataDirectoryPath, 'file.txt'), '');

    await app.init();
  });

  afterAll(async () => {
    fs.rmSync(fsDataDirectoryPath, { recursive: true });

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
});
