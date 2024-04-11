import { HttpException, HttpStatus } from '@nestjs/common';

export class FileNotFoundException extends HttpException {
  constructor(message: string = 'File not found') {
    super(message, HttpStatus.NOT_FOUND);
  }
}
