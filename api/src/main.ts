import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { join } from 'path';
import { mkdirSync } from 'fs';
import express from 'express';

// Capturar errores no manejados para verlos en logs de Railway
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
  process.exit(1);
});

console.log('[BOOT] Iniciando API...');
console.log('[BOOT] NODE_ENV:', process.env.NODE_ENV);
console.log('[BOOT] DB host:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]);

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
bootstrap().catch((err) => {
  console.error('[FATAL] bootstrap failed:', err);
  process.exit(1);
});
