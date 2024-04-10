import { GetObjectCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { Inject, Injectable } from '@nestjs/common';

import { AppConfig } from '../interfaces';

import * as fs from 'fs';
import * as path from 'path';

import { LocalFilesListMetaDto } from 'src/dtos';
import { FileDto } from 'src/dtos/file.dto';
import { appConfigFactory } from 'src/config/app-config.factory';
import { DataWithMetaResponseDto } from 'src/common/dtos';

@Injectable()
export class S3Service {
  private readonly s3: S3;

  constructor(
    @Inject(appConfigFactory.KEY) private readonly config: AppConfig,
  ) {
    this.s3 = new S3(
      config.awsProfile
        ? {
            ...(config.awsProfile && {
              credentials: fromIni({ profile: config.awsProfile }),
            }),
            endpoint: config.s3EndpointUrl,
            forcePathStyle: true,
          }
        : {
            endpoint: config.s3EndpointUrl,
            forcePathStyle: true,
          },
    );
  }

  public async listFiles(): Promise<
    DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto>
  > {
    const response = await this.s3.listObjectsV2({
      Bucket: this.config.s3DataBucketName,
    });
    const files: FileDto[] = [];

    if (!response.Contents) throw new Error('No files found');

    for (const file of response.Contents) {
      files.push(
        new FileDto({
          name: file.Key,
          size: file.Size,
          lastModified: file.LastModified,
        }),
      );
    }

    return { data: files, meta: { count: files.length } };
  }

  async copyFileFromRemoteToLocal(
    destinationFilePath: string,
    sourceFilePath: string,
  ): Promise<void> {
    try {
      const { Body } = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.config.s3DataBucketName,
          Key: path.join(this.config.s3DataBucketPath, sourceFilePath),
        }),
      );
      if (!Body) throw new Error('Failed to get file from S3');

      fs.writeFileSync(
        path.join(this.config.localDirectoryName, destinationFilePath),
        await Body.transformToString(),
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
        Body: fs.readFileSync(
          path.join(this.config.localDirectoryName, sourceFilePath),
        ),
        Key: path.join(this.config.s3DataBucketPath, destinationFilePath),
      }),
    );
  }
}
