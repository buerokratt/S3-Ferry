import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import {
  DataWithMetaResponseDto,
  FileDto,
  LocalFilesListMetaDto,
} from '../../common/dtos';
import {
  FileNotFoundException,
  InvalidStorageConfigKeyException,
} from '../../common/exceptions';
import { s3ConfigFactory } from '../config';
import { S3_DEFAULT_CONFIG_KEY } from '../s3.constants';

@Injectable()
export class S3Service {
  private readonly s3Clients: Record<string, S3> = {};

  constructor(
    @Inject(s3ConfigFactory.KEY)
    private readonly config: ConfigType<typeof s3ConfigFactory>,
  ) {
    for (const [key, config] of Object.entries(this.config)) {
      this.s3Clients[key] = new S3({
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        ...(config.endpointUrl && { endpoint: config.endpointUrl }),
        forcePathStyle: true,
        region: config.region,
        // Disable automatic checksum calculation to avoid compatibility issues with LocalStack
        // LocalStack doesn't fully support AWS SDK v3's flexible checksums middleware,
        // which can cause errors like "'NoneType' object has no attribute 'to_bytes'"
        requestChecksumCalculation: 'WHEN_REQUIRED',
      });
    }
  }

  public getFsDataDirectoryPath(configKey?: keyof typeof this.config): string {
    this.assertS3ClientConfigExists(configKey);
    configKey ??= S3_DEFAULT_CONFIG_KEY;
    return this.config[configKey].fsDataDirectoryPath;
  }

  public async listFiles(
    configKey?: keyof typeof this.s3Clients,
  ): Promise<DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto>> {
    this.assertS3ClientConfigExists(configKey);

    configKey ??= S3_DEFAULT_CONFIG_KEY;
    const s3 = this.s3Clients[configKey];
    const response = await s3.listObjectsV2({
      Bucket: this.config[configKey].dataBucketName,
    });
    const files: FileDto[] = [];

    if (response.Contents) {
      for (const file of response.Contents) {
        if (!file.Key?.includes('/')) {
          files.push(
            new FileDto({
              name: file.Key,
              size: file.Size,
              lastModified: file.LastModified,
            }),
          );
        }
      }
    }

    return { data: files, meta: { count: files.length } };
  }

  public async copyFileFromRemoteToLocal(
    destinationFilePath: string,
    sourceFilePath: string,
    sourceConfigKey?: keyof typeof this.s3Clients,
  ): Promise<void> {
    this.assertS3ClientConfigExists(sourceConfigKey);

    try {
      sourceConfigKey ??= S3_DEFAULT_CONFIG_KEY;
      const s3 = this.s3Clients[sourceConfigKey];
      const config = this.config[sourceConfigKey];
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: config.dataBucketName,
          Key: path.join(config.dataBucketPath, sourceFilePath),
        }),
      );

      const writeStream = fs.createWriteStream(
        path.join(config.fsDataDirectoryPath, destinationFilePath),
      );

      await new Promise<void>((resolve, reject) => {
        (response.Body as Readable)
          .pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      });
    } catch (error) {
      throw error instanceof NoSuchKey
        ? new FileNotFoundException('File not found in S3')
        : error;
    }
  }

  public async copyFileFromLocalToRemote(
    sourceFilePath: string,
    destinationFilePath: string,
    destinationConfigKey?: keyof typeof this.s3Clients,
  ): Promise<void> {
    this.assertS3ClientConfigExists(destinationConfigKey);
    destinationConfigKey ??= S3_DEFAULT_CONFIG_KEY;

    const s3 = this.s3Clients[destinationConfigKey];
    const config = this.config[destinationConfigKey];
    const { fsDataDirectoryPath } = config;

    const fileExists = fs.existsSync(
      path.join(fsDataDirectoryPath, sourceFilePath),
    );
    if (!fileExists) throw new FileNotFoundException('File not found in FS');

    const fileBuffer = fs.readFileSync(
      path.join(fsDataDirectoryPath, sourceFilePath),
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: config.dataBucketName,
        Body: fileBuffer,
        Key: path.join(config.dataBucketPath, destinationFilePath),
      }),
    );
  }

  // Prevent invalid explicit config keys from silently falling back to the default client.
  private assertS3ClientConfigExists(
    configKey?: keyof typeof this.s3Clients,
  ): void {
    if (configKey === undefined) return;
    if (!(configKey in this.s3Clients)) {
      throw new InvalidStorageConfigKeyException(
        `Invalid config key: "${configKey}"`,
      );
    }
  }
}
