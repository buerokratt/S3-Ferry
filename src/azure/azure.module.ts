import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { azureConfigFactory } from './config';
import { AzureAccountService } from './services';

@Module({
  imports: [ConfigModule.forFeature(azureConfigFactory)],
  providers: [AzureAccountService],
  exports: [AzureAccountService],
})
export class AzureModule {}

