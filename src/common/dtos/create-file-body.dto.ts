import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';

export class CreateFileBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileLocationDto)
  readonly files!: FileLocationDto[];

  @IsString()
  readonly content!: string;
}

class FileLocationDto {
  @IsString()
  readonly storageAccountId!: string;

  @IsString()
  readonly container!: string;

  @IsString()
  readonly fileName!: string;
}
