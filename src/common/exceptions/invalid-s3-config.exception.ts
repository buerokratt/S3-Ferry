import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidS3ConfigException extends HttpException {
  constructor(message: string = 'Invalid S3 config') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
