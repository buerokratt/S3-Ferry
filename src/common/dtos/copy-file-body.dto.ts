import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Validate } from 'class-validator';

import { StorageConfigKey } from '../decorators';
import { StorageType } from '../enums';
import { PathConstraint, UniqueValuesConstraint } from '../validators';

export class CopyFileBodyDto {
  @IsString()
  @Validate(PathConstraint)
  readonly destinationFilePath!: string;

  @ApiProperty({ enum: StorageType })
  @IsEnum(StorageType)
  readonly destinationStorageType!: StorageType;

  @StorageConfigKey('destinationStorageType')
  readonly destinationConfigKey?: string;

  @IsString()
  @Validate(PathConstraint)
  readonly sourceFilePath!: string;

  @ApiProperty({ enum: StorageType })
  @IsEnum(StorageType)
  @Validate(UniqueValuesConstraint, [
    'destinationStorageType',
    'sourceStorageType',
  ])
  readonly sourceStorageType!: StorageType;

  @StorageConfigKey('sourceStorageType')
  readonly sourceConfigKey?: string;
}
