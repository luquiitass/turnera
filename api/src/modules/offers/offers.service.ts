import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateOfferDto, UpdateOfferDto } from './dto/offers.dto.js';

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  async findByBarbershop(barbershopId: string) {
    return this.prisma.offer.findMany({
      where: { barbershopId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive() {
    return this.prisma.offer.findMany({
      where: {
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
      include: { barbershop: { select: { id: true, name: true, logoImage: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateOfferDto) {
    return this.prisma.offer.create({
      data: {
        ...dto,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
    });
  }

  async update(id: string, dto: Partial<UpdateOfferDto>) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Oferta no encontrada');

    const data: any = { ...dto };
    if (dto.validFrom) data.validFrom = new Date(dto.validFrom);
    if (dto.validUntil) data.validUntil = new Date(dto.validUntil);

    return this.prisma.offer.update({ where: { id }, data });
  }

  async deactivate(id: string) {
    return this.prisma.offer.update({ where: { id }, data: { isActive: false } });
  }
}
