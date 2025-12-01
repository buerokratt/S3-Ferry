import * as fs from 'fs';
import * as path from 'path';

import { Inject, Injectable } from '@nestjs/common';

import {
  DataWithMetaResponseDto,
  FileDto,
  LocalFilesListMetaDto,
} from '../../common/dtos';
import { fsConfigFactory } from '../config';
import { FsConfig } from '../config/fs.config.interface';

@Injectable()
export class FsService {
  constructor(@Inject(fsConfigFactory.KEY) private readonly config: FsConfig) {}

  getDataDirectoryPath(): string {
    return this.config.dataDirectoryPath;
  }

  listFiles(): DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto> {
    const files: FileDto[] = [];

    for (const file of fs.readdirSync(this.config.dataDirectoryPath)) {
      const fileStats = fs.statSync(
        path.join(this.config.dataDirectoryPath, file),
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
