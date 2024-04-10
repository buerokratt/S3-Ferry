import { Module } from '@nestjs/common';
import { ConfigModule, ConfigModule as NestConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './services/app.service';
import { S3Service } from './services/s3.service';
import { FsService } from './services/fs.service';
import { appConfigFactory } from './config/app-config.factory';

@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: `${__dirname}/../config/${process.env.NODE_ENV}.env`,
      expandVariables: true,
    }),
    ConfigModule.forFeature(appConfigFactory),
  ],
  controllers: [AppController],
  providers: [AppService, S3Service, FsService],
})
export class AppModule {}
