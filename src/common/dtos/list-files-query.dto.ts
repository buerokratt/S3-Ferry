import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { StorageConfigKey } from '../decorators';
import { StorageType } from '../enums';

export class ListFilesQueryDto {
  @ApiProperty({ enum: StorageType })
  @IsEnum(StorageType)
  readonly type!: StorageType;

  @StorageConfigKey('type')
  readonly configKey?: string;
}
