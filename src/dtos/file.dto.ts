import { Expose, plainToClass } from 'class-transformer';
import { IsDate, IsNumber, IsString } from 'class-validator';

export class FileDto {
  @Expose()
  @IsString()
  readonly name?: string;

  @Expose()
  @IsDate()
  readonly lastModified?: Date;

  @Expose()
  @IsNumber()
  readonly size?: number;

  constructor(args: FileDto) {
    Object.assign(
      this,
      plainToClass(FileDto, args, { excludeExtraneousValues: true }),
    );
  }
}
