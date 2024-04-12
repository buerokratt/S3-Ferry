import { Body, Controller, Get, Post, Query, Version } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { ApiOkDataWithMetaResponse } from './common/decorators';
import { DataWithMetaResponseDto } from './common/dtos';
import {
  CopyFileBodyDto,
  FileDto,
  ListFilesQueryDto,
  LocalFilesListMetaDto,
} from './dtos';
import { AppService } from './services';

@Controller('')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/')
  @ApiOperation({ summary: 'Root' })
  get(): { data: string } {
    return { data: 'S3 Ferry' };
  }

  @Version('1')
  @Get('/files')
  @ApiOkDataWithMetaResponse({
    data: { type: FileDto, isArray: true },
    meta: { type: LocalFilesListMetaDto },
  })
  @ApiOperation({ summary: 'List local or remote files' })
  async listFiles(
    @Query() query: ListFilesQueryDto,
  ): Promise<DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto>> {
    return await this.appService.listFiles(query.type);
  }

  @Version('1')
  @Post('/files/copy')
  @ApiOperation({ summary: 'Copy file from source to destination' })
  async copyFile(@Body() data: CopyFileBodyDto): Promise<void> {
    return this.appService.copyFile(data);
  }
}
