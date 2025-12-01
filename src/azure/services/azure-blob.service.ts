import { BlobServiceClient } from '@azure/storage-blob';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { azureConfigFactory } from '../config';
import { AzureConfig } from '../config/azure.config.interface';

@Injectable()
export class AzureBlobService {
  constructor(
    @Inject(azureConfigFactory.KEY) private readonly config: AzureConfig,
  ) {}

  async createBlob(
    storageAccountId: string,
    containerName: string,
    blobName: string,
    content: string,
  ): Promise<void> {
    const account = this.config.accounts.get(storageAccountId);
    if (!account) {
      throw new NotFoundException(
        `Storage account not found: ${storageAccountId}`,
      );
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(
      account.connectionString,
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const containerExists = await containerClient.exists();
    if (!containerExists) {
      throw new NotFoundException(
        `Container not found: ${containerName} in storage account: ${storageAccountId}`,
      );
    }

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const contentBuffer = Buffer.from(content, 'utf-8');
    await blockBlobClient.upload(contentBuffer, contentBuffer.length);
  }
}
