import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { azureConfigFactory } from './config';
import { AzureAccountService, AzureBlobService } from './services';

@Module({
  imports: [ConfigModule.forFeature(azureConfigFactory)],
  providers: [AzureAccountService, AzureBlobService],
  exports: [AzureAccountService, AzureBlobService],
})
export class AzureModule {}
