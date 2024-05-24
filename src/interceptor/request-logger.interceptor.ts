import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs';

@Injectable()
export class RequestLogger implements NestInterceptor {
  private readonly logger = new Logger(RequestLogger.name);

  intercept(context: ExecutionContext, next: CallHandler) {
    const { originalUrl, method, params, query, body } = context
      .switchToHttp()
      .getRequest();
    const { statusCode } = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap((data) => {
        this.logger.log(
          `Request: {method: ${method}, url: ${originalUrl}, params: ${JSON.stringify(params)}, query: ${JSON.stringify(query)}, body: ${JSON.stringify(body)}}`,
        );

        this.logger.log(
          `Response: {statusCode: ${statusCode}, responseData: ${JSON.stringify(data ?? {})}}`,
        );
      }),
    );
  }
}
