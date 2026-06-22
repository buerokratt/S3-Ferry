import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { AzureAccountService, AzureBlobService } from '../azure/services';
import {
  CopyFileBodyDto,
  CreateFileBodyDto,
  CreateSignedDownloadUrlBodyDto,
  CreateSignedUploadUrlBodyDto,
  DataWithMetaResponseDto,
  DeleteFileBodyDto,
  FileDto,
  ListFilesQueryDto,
  LocalFilesListMetaDto,
  StorageAccountDto,
} from '../common/dtos';
import { StorageType } from '../common/enums';
import {
  FileNotFoundException,
  InternalServerException,
  InvalidStorageConfigKeyException,
} from '../common/exceptions';
import { FsService } from '../fs';
import { S3Service } from '../s3';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly fsService: FsService,
    private readonly s3Service: S3Service,
    private readonly azureAccountService: AzureAccountService,
    private readonly azureBlobService: AzureBlobService,
  ) {}

  async listFiles(
    query: ListFilesQueryDto,
  ): Promise<DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto>> {
    const { type: storageType, configKey } = query;
    try {
      switch (storageType) {
        case StorageType.FS:
          return this.fsService.listFiles(
            this.s3Service.getFsDataDirectoryPath(configKey),
          );

        case StorageType.S3:
          return await this.s3Service.listFiles(configKey);

        default:
          throw new Error(`Storage type not supported: ${storageType}`);
      }
    } catch (error) {
      this.logger.error(
        `Listing files failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
      throw error;
    }
  }

  async copyFile(data: CopyFileBodyDto): Promise<void> {
    try {
      switch (data.destinationStorageType) {
        case StorageType.FS:
          await this.s3Service.copyFileFromRemoteToLocal(
            data.destinationFilePath,
            data.sourceFilePath,
            data.sourceConfigKey,
            data.destinationConfigKey,
          );
          break;

        case StorageType.S3:
          await this.s3Service.copyFileFromLocalToRemote(
            data.sourceFilePath,
            data.destinationFilePath,
            data.sourceConfigKey,
            data.destinationConfigKey,
          );
          break;
      }
    } catch (error) {
      this.logger.error(
        `Copying files failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
      if (error instanceof InvalidStorageConfigKeyException) throw error;
      throw error instanceof FileNotFoundException
        ? new FileNotFoundException(error.message)
        : new InternalServerException();
    }
  }

  listAccounts(): StorageAccountDto[] {
    try {
      // For now, only return Azure accounts
      // In the future, this will aggregate accounts from all storage types
      return this.azureAccountService.listAccounts();
    } catch (error) {
      this.logger.error(
        `Listing storage accounts failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
      throw error;
    }
  }

  async createFile(data: CreateFileBodyDto): Promise<void> {
    try {
      // Create files at all specified locations with the same content in parallel
      await Promise.all(
        data.files.map((file) => {
          // Infer storage type from account ID (e.g., "azure-account1" -> Azure, "s3-key" -> S3)
          if (file.storageAccountId.startsWith('azure-')) {
            return this.azureBlobService.createBlob(
              file.storageAccountId,
              file.container,
              file.fileName,
              data.content,
            );
          } else {
            const errorMessage = `Storage type not supported for account: ${file.storageAccountId}`;
            this.logger.error(
              `${errorMessage}. Account ID format should start with 'azure-' for Azure storage.`,
            );
            throw new BadRequestException(errorMessage);
          }
        }),
      );
    } catch (error) {
      // Re-throw HTTP exceptions (BadRequestException, NotFoundException, etc.)
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Log and wrap unexpected errors
      this.logger.error(
        `Creating file failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
      throw new InternalServerException(
        `Failed to create file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteFile(data: DeleteFileBodyDto): Promise<void> {
    try {
      // Delete files at all specified locations in parallel
      await Promise.all(
        data.files.map((file) => {
          // Infer storage type from account ID (e.g., "azure-account1" -> Azure, "s3-key" -> S3)
          if (file.storageAccountId.startsWith('azure-')) {
            return this.azureBlobService.deleteBlob(
              file.storageAccountId,
              file.container,
              file.fileName,
            );
          } else {
            const errorMessage = `Storage type not supported for account: ${file.storageAccountId}`;
            this.logger.error(
              `${errorMessage}. Account ID format should start with 'azure-' for Azure storage.`,
            );
            throw new BadRequestException(errorMessage);
          }
        }),
      );
    } catch (error) {
      // Re-throw HTTP exceptions (BadRequestException, NotFoundException, etc.)
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Log and wrap unexpected errors
      this.logger.error(
        `Deleting file failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
      throw new InternalServerException(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public async createSignedDownloadUrl(
    data: CreateSignedDownloadUrlBodyDto,
  ): Promise<{ readonly url: string }> {
    switch (data.type) {
      case StorageType.S3: {
        const fileExists = await this.s3Service.fileExists(
          data.filePath,
          data.configKey,
        );

        if (!fileExists) {
          throw new FileNotFoundException('File not found in S3');
        }

        return {
          url: await this.s3Service.createSignedDownloadUrl(
            data.filePath,
            data.expiresInSec,
            data.configKey,
          ),
        };
      }

      default:
        throw new Error(`Storage type not supported: ${data.type}`);
    }
  }

  public async createSignedUploadUrl(
    data: CreateSignedUploadUrlBodyDto,
  ): Promise<{ readonly url: string }> {
    switch (data.type) {
      case StorageType.S3:
        return {
          url: await this.s3Service.createSignedUploadUrl(
            data.filePath,
            data.expiresInSec,
            data.configKey,
            data.fileName,
            data.mimeType,
          ),
        };

      default:
        throw new Error(`Storage type not supported: ${data.type}`);
    }
  }
}
