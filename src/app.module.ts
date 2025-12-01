import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigModule as NestConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { appConfigFactory } from './config';
import { AppService, FsService, S3Service } from './services';

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
  ],
  controllers: [AppController],
  providers: [AppService, S3Service, FsService],
})
export class AppModule {}
