import { IsEnum, IsString, Validate } from 'class-validator';

import { PathConstraint, UniqueValuesConstraint } from '../common/validators';
import { StorageType } from '../enums';

export class CopyFileBodyDto {
  @IsString()
  @Validate(PathConstraint)
  readonly destinationFilePath: string;

  @IsEnum(StorageType)
  readonly destinationStorageType: StorageType;

  @IsString()
  @Validate(PathConstraint)
  readonly sourceFilePath: string;

  @IsEnum(StorageType)
  @Validate(UniqueValuesConstraint, [
    'destinationStorageType',
    'sourceStorageType',
  ])
  readonly sourceStorageType: StorageType;
}
