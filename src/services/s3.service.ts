import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

import { GetObjectCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';

import { DataWithMetaResponseDto } from '../common/dtos';
import { appConfigFactory } from '../config';
import { FileDto, LocalFilesListMetaDto } from '../dtos';
import { AppConfig } from '../interfaces';

@Injectable()
export class S3Service {
  private readonly s3: S3;

  constructor(
    @Inject(appConfigFactory.KEY) private readonly config: AppConfig,
  ) {
    this.s3 = new S3({
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
      },
      endpoint: config.s3EndpointUrl,
      forcePathStyle: true,
      region: config.s3Region,
    });
  }

  public async listFiles(): Promise<
    DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto>
  > {
    const response = await this.s3.listObjectsV2({
      Bucket: this.config.s3DataBucketName,
    });
    const files: FileDto[] = [];

    if (response.Contents) {
      for (const file of response.Contents) {
        files.push(
          new FileDto({
            name: file.Key,
            size: file.Size,
            lastModified: file.LastModified,
          }),
        );
      }
    }

    return { data: files, meta: { count: files.length } };
  }

  async copyFileFromRemoteToLocal(
    destinationFilePath: string,
    sourceFilePath: string,
  ): Promise<void> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.config.s3DataBucketName,
          Key: path.join(this.config.s3DataBucketPath, sourceFilePath),
        }),
      );
      if (!response.Body) throw new Error('Failed to get file from S3');

      (response.Body as Readable).pipe(
        fs.createWriteStream(
          path.join(this.config.fsDataDirectoryPath, destinationFilePath),
        ),
      );
    } catch (error) {
      throw new Error(`Error copying file: ${error}`);
    }
  }

  async copyFileFromLocalToRemote(
    sourceFilePath: string,
    destinationFilePath: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.s3DataBucketName,
        Body: fs.createReadStream(
          path.join(this.config.fsDataDirectoryPath, sourceFilePath),
        ),
        Key: path.join(this.config.s3DataBucketPath, destinationFilePath),
      }),
    );
  }
}
