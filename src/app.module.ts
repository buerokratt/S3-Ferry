import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigModule as NestConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { appConfigFactory } from './common/config';
import { AzureModule } from './azure';
import { FsModule } from './fs';
import { S3Module } from './s3';
import { AppService } from './services';

@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: join(
        process.cwd(),
        'config',
        `${process.env.NODE_ENV || 'development'}.env`,
      ),
      expandVariables: true,
    }),
    ConfigModule.forFeature(appConfigFactory),
    AzureModule,
    FsModule,
    S3Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
