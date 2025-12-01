import { IsString } from 'class-validator';

export class CreateFileBodyDto {
  @IsString()
  readonly storageAccountId!: string;

  @IsString()
  readonly container!: string;

  @IsString()
  readonly fileName!: string;

  @IsString()
  readonly content!: string;
}
