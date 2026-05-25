import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { ImageType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

@Controller('upload')
export class UploadController {
  constructor(private prisma: PrismaService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Solo se permiten imágenes'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @Body('name') name?: string,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (!type || !Object.values(ImageType).includes(type as ImageType)) {
      throw new BadRequestException(`Tipo inválido. Valores: ${Object.values(ImageType).join(', ')}`);
    }

    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/uploads/${file.filename}`;

    return this.prisma.image.create({
      data: {
        path: file.path,
        url,
        name: name || file.originalname,
        type: type as ImageType,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  }
}
