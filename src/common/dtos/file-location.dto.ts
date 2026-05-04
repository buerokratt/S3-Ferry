import { IsString, Validate } from 'class-validator';

import { PathConstraint } from '../validators';

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
