import { Type } from 'class-transformer';
import { IsArray, IsString, Validate, ValidateNested } from 'class-validator';

import { PathConstraint } from '../validators';

export class CreateFileBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileLocationDto)
  readonly files!: FileLocationDto[];

  @IsString()
  readonly content!: string;
}

export class FileLocationDto {
  @IsString()
  readonly storageAccountId!: string;

  @IsString()
  @Validate(PathConstraint)
  readonly container!: string;

  @IsString()
  @Validate(PathConstraint)
  readonly fileName!: string;
}
