import { Module } from '@nestjs/common';

import { FsService } from './services';

@Module({
  providers: [FsService],
  exports: [FsService],
})
export class FsModule {}
