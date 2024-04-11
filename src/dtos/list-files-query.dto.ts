import { IsEnum } from 'class-validator';

import { StorageType } from '../enums';

export class ListFilesQueryDto {
  @IsEnum(StorageType)
  readonly type: StorageType;
}
