import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateServiceDto, UpdateServiceDto, AddServiceToBarbershopDto, UpdateBarbershopServiceDto } from './dto/services.dto.js';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  // ==================== GLOBAL CATALOG ====================

  async findAll() {
    return this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        barbershops: {
          where: { isActive: true },
          include: { barbershop: { select: { id: true, name: true, address: true } } },
        },
      },
    });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }

  async create(dto: CreateServiceDto) {
    const normalized = dto.name.toUpperCase().trim();
    const existing = await this.prisma.service.findUnique({ where: { nameNormalized: normalized } });
    if (existing) throw new ConflictException('Ya existe un servicio con ese nombre');

    return this.prisma.service.create({
      data: {
        name: dto.name.trim(),
        nameNormalized: normalized,
        description: dto.description,
        category: dto.category,
        imageUrl: dto.imageUrl,
      },
    });
  }

  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Servicio no encontrado');

    const data: any = { ...dto };
    if (dto.name) {
      const normalized = dto.name.toUpperCase().trim();
      const dup = await this.prisma.service.findFirst({
        where: { nameNormalized: normalized, id: { not: id } },
      });
      if (dup) throw new ConflictException('Ya existe un servicio con ese nombre');
      data.name = dto.name.trim();
      data.nameNormalized = normalized;
    }
    return this.prisma.service.update({ where: { id }, data });
  }

  async deactivate(id: string) {
    return this.prisma.service.update({ where: { id }, data: { isActive: false } });
  }

  // ==================== BARBERSHOP SERVICES ====================

  async findByBarbershop(barbershopId: string) {
    return this.prisma.barbershopService.findMany({
      where: { barbershopId, isActive: true },
      include: { service: true },
      orderBy: { service: { name: 'asc' } },
    });
  }

  async addToBarbershop(dto: AddServiceToBarbershopDto) {
    const existing = await this.prisma.barbershopService.findUnique({
      where: { barbershopId_serviceId: { barbershopId: dto.barbershopId, serviceId: dto.serviceId } },
    });
    if (existing) throw new ConflictException('Este servicio ya esta asignado a esta barberia');

    return this.prisma.barbershopService.create({
      data: dto,
      include: { service: true },
    });
  }

  async updateBarbershopService(id: string, dto: UpdateBarbershopServiceDto) {
    return this.prisma.barbershopService.update({
      where: { id },
      data: dto,
      include: { service: true },
    });
  }

  async removeFromBarbershop(id: string) {
    return this.prisma.barbershopService.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
