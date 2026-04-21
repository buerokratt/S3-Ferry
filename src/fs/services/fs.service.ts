import * as fs from 'fs';
import * as path from 'path';

import { Injectable } from '@nestjs/common';

import {
  DataWithMetaResponseDto,
  FileDto,
  LocalFilesListMetaDto,
} from '../../common/dtos';

@Injectable()
export class FsService {
  public listFiles(
    dataDirectoryPath: string,
  ): DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto> {
    const files: FileDto[] = [];

    for (const file of fs.readdirSync(dataDirectoryPath)) {
      const fileStats = fs.statSync(path.join(dataDirectoryPath, file));

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
