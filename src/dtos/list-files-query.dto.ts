import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { StorageType } from '../enums';

export class ListFilesQueryDto {
  @ApiProperty()
  @IsEnum(StorageType)
  readonly type: StorageType;
}
