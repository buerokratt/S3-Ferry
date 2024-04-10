import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToClass } from 'class-transformer';
import { IsDate, IsNumber, IsString } from 'class-validator';

export class FileDto {
  @Expose()
  @ApiProperty()
  @IsString()
  readonly name?: string;

  @Expose()
  @ApiProperty()
  @IsDate()
  readonly lastModified?: Date;

  @Expose()
  @ApiProperty()
  @IsNumber()
  readonly size?: number;

  constructor(args: FileDto) {
    Object.assign(
      this,
      plainToClass(FileDto, args, { excludeExtraneousValues: true }),
    );
  }
}
