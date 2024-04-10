import { Inject, Injectable } from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';

import { LocalFilesListMetaDto } from '../dtos';
import { FileDto } from '../dtos/file.dto';
import { AppConfig } from 'src/interfaces';
import { appConfigFactory } from 'src/config/app-config.factory';
import { DataWithMetaResponseDto } from 'src/common/dtos';

@Injectable()
export class FsService {
  constructor(
    @Inject(appConfigFactory.KEY) private readonly config: AppConfig,
  ) {}

  listFiles(): DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto> {
    const files: FileDto[] = [];

    for (const file of fs.readdirSync(this.config.localDirectoryName)) {
      const fileStats = fs.statSync(
        path.join(this.config.localDirectoryName, file),
      );

      files.push(
        new FileDto({
          name: file,
          size: fileStats.size,
          lastModified: fileStats.mtime,
        }),
      );
    }

    return { data: files, meta: { count: files.length } };
  }
}
