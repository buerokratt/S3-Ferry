import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidStorageConfigKeyException extends HttpException {
  constructor(message: string = 'Invalid storage config key') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
