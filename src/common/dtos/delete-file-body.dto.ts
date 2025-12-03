import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';

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
  readonly container!: string;

  @IsString()
  readonly fileName!: string;
}
