import { Expose } from 'class-transformer';

export class SignedUrlResponseDto {
  @Expose()
  readonly url!: string;
}
