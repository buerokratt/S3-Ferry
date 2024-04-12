process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { appConfigFactory } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const apiConfig = app.get(appConfigFactory.KEY);
  if (apiConfig.corsOrigin) app.enableCors({ origin: apiConfig.corsOrigin });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableVersioning({ type: VersioningType.URI });

  if (apiConfig.documentationEnabled) {
    const config = new DocumentBuilder()
      .addBearerAuth({ in: 'header', type: 'http' })
      .setTitle('API Documentation')
      .setVersion('1.0.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('documentation', app, document, {
      swaggerOptions: {
        operationsSorter: 'alpha',
        persistAuthorization: true,
        tagsSorter: 'alpha',
      },
    });
  }

  await app.listen(3000);
}
bootstrap();
