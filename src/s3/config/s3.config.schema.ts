import { IsNotEmpty, IsString } from 'class-validator';

export class S3ConfigSchema {
  @IsString()
  @IsNotEmpty()
  readonly region!: string;

  @IsString()
  @IsNotEmpty()
  readonly endpointUrl!: string;

  @IsString()
  @IsNotEmpty()
  readonly accessKeyId!: string;

  @IsString()
  @IsNotEmpty()
  readonly secretAccessKey!: string;

  @IsString()
  @IsNotEmpty()
  readonly dataBucketName!: string;

  @IsString()
  readonly dataBucketPath!: string;

  @IsString()
  @IsNotEmpty()
  readonly fsDataDirectoryPath!: string;
}
