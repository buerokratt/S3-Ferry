import { Injectable } from '@nestjs/common';

import { CopyFileBodyDto, LocalFilesListMetaDto } from 'src/dtos';
import { StorageType } from 'src/enums';
import { FsService } from './fs.service';
import { S3Service } from './s3.service';
import { DataWithMetaResponseDto } from 'src/common/dtos';
import { FileDto } from 'src/dtos/file.dto';

@Injectable()
export class AppService {
  constructor(
    private readonly fsService: FsService,
    private readonly s3Service: S3Service,
  ) {}

  async listFiles(
    storageType: StorageType,
  ): Promise<DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto>> {
    switch (storageType) {
      case StorageType.FS:
        return this.fsService.listFiles();

      case StorageType.S3:
        return await this.s3Service.listFiles();
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
      throw new Error(`Error copying file: ${error}`);
    }
  }
}
