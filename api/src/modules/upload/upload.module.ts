import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({ imports: [PrismaModule], controllers: [UploadController] })
export class UploadModule {}
