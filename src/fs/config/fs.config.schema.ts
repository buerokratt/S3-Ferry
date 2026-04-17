import { IsNotEmpty, IsString } from 'class-validator';
export class FsConfigSchema {
  @IsString()
  @IsNotEmpty()
  readonly dataDirectoryPath!: string;
}
