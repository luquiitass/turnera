import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { R2Service } from './r2.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({ imports: [PrismaModule], controllers: [UploadController], providers: [R2Service], exports: [R2Service] })
export class UploadModule {}
