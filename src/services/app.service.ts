import { Injectable, Logger } from '@nestjs/common';

import {
  CopyFileBodyDto,
  DataWithMetaResponseDto,
  FileDto,
  LocalFilesListMetaDto,
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
}
