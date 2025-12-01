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
  DataWithMetaResponseDto,
  FileDto,
  LocalFilesListMetaDto,
  StorageAccountDto,
} from '../common/dtos';
import { StorageType } from '../common/enums';
import {
  FileNotFoundException,
  InternalServerException,
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
    storageType: StorageType,
  ): Promise<DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto>> {
    try {
      switch (storageType) {
        case StorageType.FS:
          return this.fsService.listFiles();

        case StorageType.S3:
          return await this.s3Service.listFiles();

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
            this.fsService.getDataDirectoryPath(),
          );
          break;

        case StorageType.S3:
          await this.s3Service.copyFileFromLocalToRemote(
            data.sourceFilePath,
            data.destinationFilePath,
            this.fsService.getDataDirectoryPath(),
          );
          break;
      }
    } catch (error) {
      this.logger.error(
        `Copying files failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
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
            throw new BadRequestException(
              `Storage type not supported for account: ${file.storageAccountId}`,
            );
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
}
