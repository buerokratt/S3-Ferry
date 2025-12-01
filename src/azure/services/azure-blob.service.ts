import { BlobServiceClient } from '@azure/storage-blob';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { azureConfigFactory } from '../config';
import { AzureConfig } from '../config/azure.config.interface';

@Injectable()
export class AzureBlobService {
  private readonly logger = new Logger(AzureBlobService.name);

  constructor(
    @Inject(azureConfigFactory.KEY) private readonly config: AzureConfig,
  ) {}

  /**
   * Creates a new blob or replaces an existing one if it already exists.
   * The upload operation will overwrite any existing blob with the same name.
   */
  async createBlob(
    storageAccountId: string,
    containerName: string,
    blobName: string,
    content: string,
  ): Promise<void> {
    const account = this.config.accounts.get(storageAccountId);
    if (!account) {
      const errorMessage = `Storage account not found: ${storageAccountId}`;
      this.logger.error(
        `${errorMessage}. Available accounts: ${Array.from(this.config.accounts.keys()).join(', ')}`,
      );
      throw new NotFoundException(errorMessage);
    }

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(
        account.connectionString,
      );
      const containerClient =
        blobServiceClient.getContainerClient(containerName);

      const containerExists = await containerClient.exists();
      if (!containerExists) {
        const errorMessage = `Container not found: ${containerName} in storage account: ${storageAccountId}`;
        this.logger.error(errorMessage);
        throw new NotFoundException(errorMessage);
      }

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const contentBuffer = Buffer.from(content, 'utf-8');
      await blockBlobClient.upload(contentBuffer, contentBuffer.length);
    } catch (error) {
      // Re-throw NotFoundException (already logged above)
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Log and re-throw unexpected errors
      const errorMessage = `Failed to create blob: ${blobName} in container: ${containerName} for storage account: ${storageAccountId}`;
      this.logger.error(
        `${errorMessage}. Error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
