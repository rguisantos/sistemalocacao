import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { validarEnv } from './config/env.validation';

async function bootstrap() {
  const env = validarEnv(); // [AUDIT P0] falha cedo se faltar segredo/config

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('API Locações e Cobranças')
    .setDescription('Auth, permissões, cadastros, cobrança e sincronização.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(env.PORT);
}
bootstrap();
