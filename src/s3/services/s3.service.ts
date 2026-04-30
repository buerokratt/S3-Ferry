import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
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
    const files: FileDto[] = [];
    let continuationToken: string | undefined;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await s3.listObjectsV2({
        Bucket: this.config[configKey].dataBucketName,
        ...(continuationToken && { ContinuationToken: continuationToken }),
      });

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

      continuationToken = response.NextContinuationToken;
      hasMorePages = Boolean(response.IsTruncated && continuationToken);
    }

    return { data: files, meta: { count: files.length } };
  }

  public async copyFileFromRemoteToLocal(
    destinationFilePath: string,
    sourceFilePath: string,
    sourceConfigKey?: keyof typeof this.s3Clients,
    destinationConfigKey?: keyof typeof this.s3Clients,
  ): Promise<void> {
    this.assertS3ClientConfigExists(sourceConfigKey);
    this.assertS3ClientConfigExists(destinationConfigKey);

    try {
      sourceConfigKey ??= S3_DEFAULT_CONFIG_KEY;
      destinationConfigKey ??= S3_DEFAULT_CONFIG_KEY;
      const s3 = this.s3Clients[sourceConfigKey];
      const sourceConfig = this.config[sourceConfigKey];
      const destinationConfig = this.config[destinationConfigKey];
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: sourceConfig.dataBucketName,
          Key: path.join(sourceConfig.dataBucketPath, sourceFilePath),
        }),
      );

      const writeStream = fs.createWriteStream(
        path.join(destinationConfig.fsDataDirectoryPath, destinationFilePath),
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
    sourceConfigKey?: keyof typeof this.s3Clients,
    destinationConfigKey?: keyof typeof this.s3Clients,
  ): Promise<void> {
    this.assertS3ClientConfigExists(sourceConfigKey);
    this.assertS3ClientConfigExists(destinationConfigKey);
    destinationConfigKey ??= S3_DEFAULT_CONFIG_KEY;
    sourceConfigKey ??= S3_DEFAULT_CONFIG_KEY;

    const s3 = this.s3Clients[destinationConfigKey];
    const destinationConfig = this.config[destinationConfigKey];
    const sourceFileAbsolutePath = path.join(
      this.config[sourceConfigKey].fsDataDirectoryPath,
      sourceFilePath,
    );

    const fileExists = fs.existsSync(sourceFileAbsolutePath);
    if (!fileExists) throw new FileNotFoundException('File not found in FS');

    const fileBuffer = fs.readFileSync(sourceFileAbsolutePath);

    await s3.send(
      new PutObjectCommand({
        Bucket: destinationConfig.dataBucketName,
        Body: fileBuffer,
        Key: path.join(destinationConfig.dataBucketPath, destinationFilePath),
      }),
    );
  }

  public async fileExists(
    filePath: string,
    configKey?: keyof typeof this.s3Clients,
  ): Promise<boolean> {
    this.assertS3ClientConfigExists(configKey);
    configKey ??= S3_DEFAULT_CONFIG_KEY;
    const s3 = this.s3Clients[configKey];
    const config = this.config[configKey];
    try {
      return !!(await s3.send(
        new HeadObjectCommand({
          Bucket: config.dataBucketName,
          Key: path.join(config.dataBucketPath, filePath),
        }),
      ));
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') return false;
      throw error;
    }
  }

  public async createSignedDownloadUrl(
    filePath: string,
    expiresInSec = 3600,
    configKey?: keyof typeof this.s3Clients,
  ): Promise<string> {
    this.assertS3ClientConfigExists(configKey);
    configKey ??= S3_DEFAULT_CONFIG_KEY;
    const s3 = this.s3Clients[configKey];
    const config = this.config[configKey];
    try {
      return await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: config.dataBucketName, Key: filePath }),
        {
          expiresIn: expiresInSec,
        },
      );
    } catch (error) {
      throw error instanceof NoSuchKey
        ? new FileNotFoundException('File not found in S3')
        : error;
    }
  }

  public async createSignedUploadUrl(
    path: string,
    expiresInSec = 3600,
    configKey?: keyof typeof this.s3Clients,
    fileName?: string,
    mimeType?: string,
  ): Promise<string> {
    this.assertS3ClientConfigExists(configKey);
    configKey ??= S3_DEFAULT_CONFIG_KEY;
    const s3 = this.s3Clients[configKey];
    const config = this.config[configKey];
    try {
      return await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: config.dataBucketName,
          ContentDisposition: fileName
            ? `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
            : undefined,
          ContentType: mimeType ?? undefined,
          Key: path,
        }),
        {
          expiresIn: expiresInSec,
        },
      );
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
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
