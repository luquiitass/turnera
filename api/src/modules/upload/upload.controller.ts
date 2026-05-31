import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImageType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { R2Service } from './r2.service.js';

@Controller('upload')
export class UploadController {
  constructor(
    private prisma: PrismaService,
    private r2: R2Service,
  ) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // buffer en memoria → lo subimos a R2
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

    const { key, url, size } = await this.r2.upload(file.buffer, file.originalname, file.mimetype);

    return this.prisma.image.create({
      data: {
        path:     key,
        url,
        name:     name || file.originalname,
        type:     type as ImageType,
        mimeType: 'image/webp',
        size,
      },
    });
  }
}
