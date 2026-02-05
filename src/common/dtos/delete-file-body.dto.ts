import { Type } from 'class-transformer';
import { IsArray, IsString, Validate, ValidateNested } from 'class-validator';

import { PathConstraint } from '../validators';

export class DeleteFileBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileLocationDto)
  readonly files!: FileLocationDto[];
}

class FileLocationDto {
  @IsString()
  readonly storageAccountId!: string;

  @IsString()
  @Validate(PathConstraint)
  readonly container!: string;

  @IsString()
  @Validate(PathConstraint)
  readonly fileName!: string;
}
