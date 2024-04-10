import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './services/app.service';
import {
  CopyFileBodyDto,
  ListFilesQueryDto,
  LocalFilesListMetaDto,
} from './dtos';
import { ApiOkDataWithMetaResponse } from './common/decorators';
import { DataWithMetaResponseDto } from './common/dtos';
import { FileDto } from './dtos/file.dto';

@Controller('/files')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/')
  @ApiOkDataWithMetaResponse({
    data: { type: FileDto, isArray: true },
    meta: { type: LocalFilesListMetaDto },
  })
  async listFiles(
    @Query() query: ListFilesQueryDto,
  ): Promise<DataWithMetaResponseDto<FileDto[], LocalFilesListMetaDto>> {
    return await this.appService.listFiles(query.type);
  }

  @Post('/copy')
  async copyFile(@Body() data: CopyFileBodyDto): Promise<void> {
    return this.appService.copyFile(data);
  }
}
