import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { fsConfigFactory } from './config';
import { FsService } from './services';

@Module({
  imports: [ConfigModule.forFeature(fsConfigFactory)],
  providers: [FsService],
  exports: [FsService],
})
export class FsModule {}

