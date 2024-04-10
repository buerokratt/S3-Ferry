import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Validate } from 'class-validator';
import { NormalizeFilePath } from 'src/common/transformers';
import { UniqueValuesConstraint } from 'src/common/validators';
import { StorageType } from 'src/enums';

export class CopyFileBodyDto {
  @ApiProperty()
  @IsString()
  @Transform(NormalizeFilePath)
  readonly destinationFilePath: string;

  @ApiProperty()
  @IsEnum(StorageType)
  readonly destinationStorageType: StorageType;

  @ApiProperty()
  @IsString()
  @Transform(NormalizeFilePath)
  readonly sourceFilePath: string;

  @ApiProperty()
  @IsEnum(StorageType)
  @Validate(UniqueValuesConstraint, [
    'destinationStorageType',
    'sourceStorageType',
  ])
  readonly sourceStorageType: StorageType;
}
