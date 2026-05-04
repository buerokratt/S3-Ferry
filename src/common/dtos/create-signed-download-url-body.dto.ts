import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Validate,
} from 'class-validator';

import { StorageConfigKey } from '../decorators';
import { StorageType } from '../enums';
import { PathConstraint } from '../validators';

export class CreateSignedDownloadUrlBodyDto {
  @ApiProperty({ enum: StorageType })
  @IsEnum(StorageType)
  readonly type!: StorageType;

  @IsString()
  @Validate(PathConstraint)
  readonly filePath!: string;

  @ApiPropertyOptional({
    description: 'Signed URL expiration time in seconds',
    default: 3600,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly expiresInSec?: number;

  @StorageConfigKey('type')
  readonly configKey?: string;
}
