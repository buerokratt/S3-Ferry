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

import {
  DataWithMetaResponseDto,
  FileDto,
  LocalFilesListMetaDto,
} from '../../common/dtos';
import { FileNotFoundException } from '../../common/exceptions';
import { s3ConfigFactory } from '../config';
import { S3Config } from '../config/s3.config.interface';

@Injectable()
export class S3Service {
  private readonly s3: S3;

  constructor(@Inject(s3ConfigFactory.KEY) private readonly config: S3Config) {
    this.s3 = new S3({
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
      // See: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-checksums.html
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  public async listFiles(): Promise<
    DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto>
  > {
    const response = await this.s3.listObjectsV2({
      Bucket: this.config.dataBucketName,
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

  async copyFileFromRemoteToLocal(
    destinationFilePath: string,
    sourceFilePath: string,
    fsDataDirectoryPath: string,
  ): Promise<void> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.config.dataBucketName,
          Key: path.join(this.config.dataBucketPath, sourceFilePath),
        }),
      );

      const writeStream = fs.createWriteStream(
        path.join(fsDataDirectoryPath, destinationFilePath),
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

  async copyFileFromLocalToRemote(
    sourceFilePath: string,
    destinationFilePath: string,
    fsDataDirectoryPath: string,
  ): Promise<void> {
    const fileExists = fs.existsSync(
      path.join(fsDataDirectoryPath, sourceFilePath),
    );
    if (!fileExists) throw new FileNotFoundException('File not found in FS');

    const fileBuffer = fs.readFileSync(
      path.join(fsDataDirectoryPath, sourceFilePath),
    );

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.dataBucketName,
        Body: fileBuffer,
        Key: path.join(this.config.dataBucketPath, destinationFilePath),
      }),
    );
  }
}
