import { Injectable, Logger } from '@nestjs/common';

import { FsService } from './fs.service';
import { S3Service } from './s3.service';
import { DataWithMetaResponseDto } from '../common/dtos';
import {
  FileNotFoundException,
  InternalServerException,
} from '../common/exceptions';
import { CopyFileBodyDto, FileDto, LocalFilesListMetaDto } from '../dtos';
import { StorageType } from '../enums';

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
      this.logger.error(`Listing files failed: ${error.stack}`);
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
          );
          break;

        case StorageType.S3:
          await this.s3Service.copyFileFromLocalToRemote(
            data.sourceFilePath,
            data.destinationFilePath,
          );
          break;
      }
    } catch (error) {
      this.logger.error(`Copying files failed: ${error.stack}`);
      throw error instanceof FileNotFoundException
        ? new FileNotFoundException(error.message)
        : new InternalServerException();
    }
  }
}
