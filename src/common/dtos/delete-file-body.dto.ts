import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';

import { FileLocationDto } from './file-location.dto';

export class DeleteFileBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileLocationDto)
  readonly files!: FileLocationDto[];
}
