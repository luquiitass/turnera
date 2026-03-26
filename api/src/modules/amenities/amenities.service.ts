import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateAmenityDto, ToggleBarbershopAmenityDto } from './dto/amenities.dto.js';

@Injectable()
export class AmenitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.amenity.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  }

  async findByBarbershop(barbershopId: string) {
    const links = await this.prisma.barbershopAmenity.findMany({
      where: { barbershopId },
      include: { amenity: true },
    });
    return links.map((l) => l.amenity);
  }

  async create(dto: CreateAmenityDto) {
    const existing = await this.prisma.amenity.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Ya existe una caracteristica con ese nombre');
    return this.prisma.amenity.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateAmenityDto>) {
    return this.prisma.amenity.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.barbershopAmenity.deleteMany({ where: { amenityId: id } });
    return this.prisma.amenity.delete({ where: { id } });
  }

  async toggle(dto: ToggleBarbershopAmenityDto) {
    const existing = await this.prisma.barbershopAmenity.findUnique({
      where: {
        barbershopId_amenityId: {
          barbershopId: dto.barbershopId,
          amenityId: dto.amenityId,
        },
      },
    });

    if (existing) {
      await this.prisma.barbershopAmenity.delete({ where: { id: existing.id } });
      return { action: 'removed' };
    }

    await this.prisma.barbershopAmenity.create({
      data: { barbershopId: dto.barbershopId, amenityId: dto.amenityId },
    });
    return { action: 'added' };
  }

  async seedDefaults() {
    const defaults = [
      { name: 'Calefaccion', icon: 'flame-outline', category: 'Confort' },
      { name: 'Aire acondicionado', icon: 'snow-outline', category: 'Confort' },
      { name: 'WiFi', icon: 'wifi-outline', category: 'Servicios' },
      { name: 'Estacionamiento', icon: 'car-outline', category: 'Acceso' },
      { name: 'TV', icon: 'tv-outline', category: 'Entretenimiento' },
      { name: 'Musica', icon: 'musical-notes-outline', category: 'Entretenimiento' },
      { name: 'Cafe / Bebidas', icon: 'cafe-outline', category: 'Servicios' },
      { name: 'Accesibilidad', icon: 'accessibility-outline', category: 'Acceso' },
      { name: 'Bano', icon: 'water-outline', category: 'Servicios' },
      { name: 'Cargador celular', icon: 'battery-charging-outline', category: 'Servicios' },
    ];

    const results: any[] = [];
    for (const d of defaults) {
      const amenity = await this.prisma.amenity.upsert({
        where: { name: d.name },
        update: {},
        create: { ...d, isDefault: true },
      });
      results.push(amenity);
    }
    return results;
  }
}
