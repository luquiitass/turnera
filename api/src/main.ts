import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { join } from 'path';
import { mkdirSync } from 'fs';
import express from 'express';

async function bootstrap() {
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  mkdirSync(uploadsDir, { recursive: true });

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use('/uploads', express.static(join(process.cwd(), 'public', 'uploads')));
  app.setGlobalPrefix('api');

  // Health check para Railway
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/health', (_req: any, res: any) => res.json({ status: 'ok' }));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://0.0.0.0:${port}/api`);
}
bootstrap();
