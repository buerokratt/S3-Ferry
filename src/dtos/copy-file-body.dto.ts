import { Transform } from 'class-transformer';
import { IsEnum, IsString, Validate } from 'class-validator';

import { NormalizeFilePath } from '../common/transformers';
import { UniqueValuesConstraint } from '../common/validators';
import { StorageType } from '../enums';

export class CopyFileBodyDto {
  @IsString()
  @Transform(NormalizeFilePath)
  readonly destinationFilePath: string;

  @IsEnum(StorageType)
  readonly destinationStorageType: StorageType;

  @IsString()
  @Transform(NormalizeFilePath)
  readonly sourceFilePath: string;

  @IsEnum(StorageType)
  @Validate(UniqueValuesConstraint, [
    'destinationStorageType',
    'sourceStorageType',
  ])
  readonly sourceStorageType: StorageType;
}
