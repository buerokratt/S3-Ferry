import { IsEnum, IsString, Validate } from 'class-validator';

import { StorageType } from '../enums';
import { PathConstraint, UniqueValuesConstraint } from '../validators';

export class CopyFileBodyDto {
  @IsString()
  @Validate(PathConstraint)
  readonly destinationFilePath!: string;

  @IsEnum(StorageType)
  readonly destinationStorageType!: StorageType;

  @IsString()
  @Validate(PathConstraint)
  readonly sourceFilePath!: string;

  @IsEnum(StorageType)
  @Validate(UniqueValuesConstraint, [
    'destinationStorageType',
    'sourceStorageType',
  ])
  readonly sourceStorageType!: StorageType;
}
