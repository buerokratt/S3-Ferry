import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { ApiOkDataWithMetaResponse } from './common/decorators';
import {
  CopyFileBodyDto,
  CreateFileBodyDto,
  CreateSignedDownloadUrlBodyDto,
  CreateSignedUploadUrlBodyDto,
  DataResponseDto,
  DataWithMetaResponseDto,
  DeleteFileBodyDto,
  FileDto,
  ListFilesQueryDto,
  LocalFilesListMetaDto,
  SignedUrlResponseDto,
  StorageAccountDto,
} from './common/dtos';
import { RequestLogger } from './common/interceptors';
import { AppService } from './services';

@Controller('')
@UseInterceptors(RequestLogger)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/')
  @ApiOperation({ summary: 'Root' })
  get(): { data: string } {
    return { data: 'Storage Ferry' };
  }

  @Version('1')
  @Get('/storage-accounts')
  @ApiOkResponse({
    type: [StorageAccountDto],
    description: 'List all available storage accounts',
  })
  @ApiOperation({ summary: 'List all available storage accounts' })
  listStorageAccounts(): StorageAccountDto[] {
    return this.appService.listAccounts();
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
    return await this.appService.listFiles(query);
  }

  @Version('1')
  @Post('/files/copy')
  @ApiOperation({ summary: 'Copy file from source to destination' })
  async copyFile(@Body() data: CopyFileBodyDto): Promise<void> {
    return this.appService.copyFile(data);
  }

  @Version('1')
  @Post('/files/create')
  @ApiOperation({ summary: 'Create a file in storage' })
  async createFile(@Body() data: CreateFileBodyDto): Promise<void> {
    return this.appService.createFile(data);
  }

  @Version('1')
  @Delete('/files/delete')
  @ApiOperation({ summary: 'Delete a file from storage' })
  async deleteFile(@Body() data: DeleteFileBodyDto): Promise<void> {
    return this.appService.deleteFile(data);
  }

  @Version('1')
  @Post('/files/signed-url/download')
  @ApiOperation({ summary: 'Create a signed download URL for a remote file' })
  async createSignedDownloadUrl(
    @Body() data: CreateSignedDownloadUrlBodyDto,
  ): Promise<DataResponseDto<SignedUrlResponseDto>> {
    return {
      data: plainToInstance(
        SignedUrlResponseDto,
        await this.appService.createSignedDownloadUrl(data),
      ),
    };
  }

  @Version('1')
  @Post('/files/signed-url/upload')
  @ApiOperation({ summary: 'Create a signed upload URL for a remote file' })
  async createSignedUploadUrl(
    @Body() data: CreateSignedUploadUrlBodyDto,
  ): Promise<DataResponseDto<SignedUrlResponseDto>> {
    return {
      data: plainToInstance(
        SignedUrlResponseDto,
        await this.appService.createSignedUploadUrl(data),
      ),
    };
  }
}
