import { BlobServiceClient } from '@azure/storage-blob';
import { Inject, Injectable } from '@nestjs/common';

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
      throw new Error(`Storage account not found: ${storageAccountId}`);
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(
      account.connectionString,
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // // Ensure the container exists
    // // Ignore 409 (Conflict) errors as they mean the container already exists
    // try {
    //   await containerClient.createIfNotExists();
    // } catch (error: unknown) {
    //   // If it's a RestError with statusCode 409, the container already exists - that's fine
    //   if (
    //     error &&
    //     typeof error === 'object' &&
    //     'statusCode' in error &&
    //     error.statusCode === 409
    //   ) {
    //     // Container already exists, continue
    //   } else {
    //     // Re-throw other errors (including 404 which might indicate account doesn't exist)
    //     throw error;
    //   }
    // }

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const contentBuffer = Buffer.from(content, 'utf-8');
    await blockBlobClient.upload(contentBuffer, contentBuffer.length);
  }
}
