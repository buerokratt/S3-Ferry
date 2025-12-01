import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { s3ConfigFactory } from './config';
import { S3Service } from './services';

@Module({
  imports: [ConfigModule.forFeature(s3ConfigFactory)],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}

