import * as fs from 'fs';
import * as path from 'path';

import { Inject, Injectable } from '@nestjs/common';

import { DataWithMetaResponseDto } from '../common/dtos';
import { appConfigFactory } from '../config';
import { FileDto, LocalFilesListMetaDto } from '../dtos';
import { AppConfig } from '../interfaces';

@Injectable()
export class FsService {
  constructor(
    @Inject(appConfigFactory.KEY) private readonly config: AppConfig,
  ) {}

  listFiles(): DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto> {
    const files: FileDto[] = [];

    for (const file of fs.readdirSync(this.config.fsDataDirectoryPath)) {
      const fileStats = fs.statSync(
        path.join(this.config.fsDataDirectoryPath, file),
      );

      if (fileStats.isFile()) {
        files.push(
          new FileDto({
            name: file,
            size: fileStats.size,
            lastModified: fileStats.mtime,
          }),
        );
      }
    }

    return { data: files, meta: { count: files.length } };
  }
}
