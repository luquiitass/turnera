import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateBarberDto, UpdateBarberDto, AssignServicesDto } from './dto/barbers.dto.js';

@Injectable()
export class BarbersService {
  constructor(private prisma: PrismaService) {}

  async findByBarbershop(barbershopId: string) {
    return this.prisma.barber.findMany({
      where: { barbershopId, isActive: true },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
        services: { include: { service: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { bookings: true } },
      },
    });
  }

  async findOne(id: string) {
    const barber = await this.prisma.barber.findUnique({
      where: { id },
      include: {
        barbershop: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
        services: { include: { service: true } },
        schedules: true,
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!barber) throw new NotFoundException('Barbero no encontrado');
    return barber;
  }

  async create(dto: CreateBarberDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException(`No existe un usuario registrado con el email ${dto.email}`);

    const barbershop = await this.prisma.barbershop.findUnique({
      where: { id: dto.barbershopId },
      include: { _count: { select: { barbers: true } } },
    });
    if (!barbershop) throw new NotFoundException('Barberia no encontrada');
    if (barbershop._count.barbers >= barbershop.maxBarbers) {
      throw new BadRequestException(`Limite de barberos alcanzado (${barbershop.maxBarbers})`);
    }

    const existing = await this.prisma.barber.findFirst({
      where: { userId: user.id, barbershopId: dto.barbershopId, isActive: true },
    });
    if (existing) throw new ConflictException('Este usuario ya es barbero en esta barberia');

    const { serviceIds, email, ...rest } = dto;
    const barber = await this.prisma.barber.create({
      data: {
        ...rest,
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        bio: dto.bio,
      },
    });

    if (serviceIds?.length) {
      await this.prisma.barberService.createMany({
        data: serviceIds.map((serviceId) => ({ barberId: barber.id, serviceId })),
      });
    }

    return this.findOne(barber.id);
  }

  async update(id: string, dto: UpdateBarberDto) {
    await this.ensureExists(id);
    return this.prisma.barber.update({
      where: { id },
      data: dto,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        services: { include: { service: true } },
      },
    });
  }

  async deactivate(id: string) {
    await this.ensureExists(id);
    return this.prisma.barber.update({ where: { id }, data: { isActive: false } });
  }

  async assignServices(barberId: string, dto: AssignServicesDto) {
    await this.ensureExists(barberId);

    await this.prisma.barberService.deleteMany({ where: { barberId } });

    if (dto.serviceIds.length) {
      await this.prisma.barberService.createMany({
        data: dto.serviceIds.map((serviceId) => ({ barberId, serviceId })),
      });
    }

    return this.findOne(barberId);
  }

  async addImage(barberId: string, imageUrl: string, caption?: string) {
    await this.ensureExists(barberId);
    const count = await this.prisma.barberImage.count({ where: { barberId } });
    return this.prisma.barberImage.create({
      data: { barberId, imageUrl, caption, sortOrder: count },
    });
  }

  async removeImage(imageId: string) {
    return this.prisma.barberImage.delete({ where: { id: imageId } });
  }

  // ==================== BARBER AGENDA ====================

  async getBarberAgenda(userId: string, date: string) {
    const barber = await this.prisma.barber.findFirst({
      where: { userId, isActive: true },
      include: { schedules: true },
    });
    if (!barber) throw new NotFoundException('No tienes perfil de barbero');

    const dateObj = new Date(date);
    const dayIndex = dateObj.getUTCDay();
    const dayMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const dayOfWeek = dayMap[dayIndex];

    const schedule = barber.schedules.find((s: any) => s.dayOfWeek === dayOfWeek);

    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const [bookings, blocks] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          barberId: barber.id,
          date: { gte: startOfDay, lte: endOfDay },
          status: { in: ['PENDIENTE', 'CONFIRMADA'] },
        },
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
          service: { select: { name: true } },
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.blockedSlot.findMany({
        where: {
          barberId: barber.id,
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { startTime: 'asc' },
      }),
    ]);

    if (!schedule) {
      return { barberId: barber.id, barberName: `${barber.firstName} ${barber.lastName}`, date, schedule: null, bookings: 0, slots: [] };
    }

    // Merge bookings and blocks into a unified timeline
    const events: any[] = [];

    for (const b of bookings) {
      events.push({
        type: 'booking',
        startMin: this.timeToMin(b.startTime),
        endMin: this.timeToMin(b.endTime),
        data: {
          id: b.id,
          clientName: `${b.user.firstName} ${b.user.lastName}`,
          clientPhone: b.user.phone,
          serviceName: b.service.name,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          notes: (b as any).notes,
        },
      });
    }

    for (const bl of blocks) {
      events.push({
        type: 'block',
        startMin: this.timeToMin(bl.startTime),
        endMin: this.timeToMin(bl.endTime),
        data: { reason: bl.reason, startTime: bl.startTime, endTime: bl.endTime },
      });
    }

    events.sort((a, b) => a.startMin - b.startMin);

    const slots: any[] = [];
    const openMin = this.timeToMin(schedule.openTime);
    const closeMin = this.timeToMin(schedule.closeTime);
    let cursor = openMin;

    for (const event of events) {
      const eStart = event.startMin;
      const eEnd = event.endMin;

      // Free block before this event
      if (cursor < eStart) {
        slots.push({
          time: this.minToTime(cursor),
          endTime: this.minToTime(eStart),
          durationMin: eStart - cursor,
          type: 'free',
          booking: null,
          block: null,
        });
      }

      if (event.type === 'booking') {
        slots.push({
          time: this.minToTime(eStart),
          endTime: this.minToTime(eEnd),
          durationMin: eEnd - eStart,
          type: 'booking',
          booking: event.data,
          block: null,
        });
      } else {
        slots.push({
          time: this.minToTime(eStart),
          endTime: this.minToTime(eEnd),
          durationMin: eEnd - eStart,
          type: 'block',
          booking: null,
          block: event.data,
        });
      }

      cursor = Math.max(cursor, eEnd);
    }

    // Free block after last event
    if (cursor < closeMin) {
      slots.push({
        time: this.minToTime(cursor),
        endTime: this.minToTime(closeMin),
        durationMin: closeMin - cursor,
        type: 'free',
        booking: null,
        block: null,
      });
    }

    return {
      barberId: barber.id,
      barberName: `${barber.firstName} ${barber.lastName}`,
      date,
      schedule: { openTime: schedule.openTime, closeTime: schedule.closeTime },
      bookings: bookings.length,
      slots,
    };
  }

  private timeToMin(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minToTime(min: number): string {
    const h = Math.floor(min / 60).toString().padStart(2, '0');
    const m = (min % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  // ==================== BARBER OWN PROFILE ====================

  async findByUserId(userId: string) {
    const barbers = await this.prisma.barber.findMany({
      where: { userId, isActive: true },
      include: {
        barbershop: { select: { id: true, name: true, address: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        services: { include: { service: true } },
        schedules: true,
        images: { orderBy: { sortOrder: 'asc' } },
        reviews: {
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { bookings: true, reviews: true } },
      },
    });
    if (!barbers.length) throw new NotFoundException('No tienes perfil de barbero');
    return barbers;
  }

  async updateByUserId(userId: string, dto: UpdateBarberDto) {
    const barber = await this.prisma.barber.findFirst({ where: { userId, isActive: true } });
    if (!barber) throw new NotFoundException('No tienes perfil de barbero');
    return this.prisma.barber.update({
      where: { id: barber.id },
      data: dto,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        services: { include: { service: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async addImageByUserId(userId: string, imageUrl: string, caption?: string) {
    const barber = await this.prisma.barber.findFirst({ where: { userId, isActive: true } });
    if (!barber) throw new NotFoundException('No tienes perfil de barbero');
    const count = await this.prisma.barberImage.count({ where: { barberId: barber.id } });
    return this.prisma.barberImage.create({
      data: { barberId: barber.id, imageUrl, caption, sortOrder: count },
    });
  }

  async removeImageByUserId(userId: string, imageId: string) {
    const barber = await this.prisma.barber.findFirst({ where: { userId, isActive: true } });
    if (!barber) throw new NotFoundException('No tienes perfil de barbero');
    const image = await this.prisma.barberImage.findUnique({ where: { id: imageId } });
    if (!image || image.barberId !== barber.id) throw new NotFoundException('Imagen no encontrada');
    return this.prisma.barberImage.delete({ where: { id: imageId } });
  }

  // ==================== BARBER REVIEWS ====================

  async getBarberReviews(barberId: string) {
    return this.prisma.review.findMany({
      where: { barberId },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBarberReviewStats(barberId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { barberId },
      select: { rating: true },
    });
    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => { distribution[r.rating]++; });
    return { average: Math.round(avg * 10) / 10, total, distribution };
  }

  private async ensureExists(id: string) {
    const b = await this.prisma.barber.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Barbero no encontrado');
    return b;
  }
}
