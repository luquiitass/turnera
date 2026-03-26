import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateBookingDto, CreateRecurringBookingDto, BookingFiltersDto } from './dto/bookings.dto.js';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBookingDto) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) throw new NotFoundException('Servicio no encontrado');

    const barber = await this.prisma.barber.findUnique({
      where: { id: dto.barberId },
      include: { barbershop: true },
    });
    if (!barber) throw new NotFoundException('Barbero no encontrado');

    // Get barbershop-specific price and duration
    const bsService = await this.prisma.barbershopService.findUnique({
      where: { barbershopId_serviceId: { barbershopId: barber.barbershopId, serviceId: dto.serviceId } },
    });
    if (!bsService) throw new BadRequestException('Esta barberia no ofrece ese servicio');

    // Verify barber offers it (if has specific assignments)
    const barberServiceCount = await this.prisma.barberService.count({ where: { barberId: dto.barberId } });
    if (barberServiceCount > 0) {
      const barberService = await this.prisma.barberService.findUnique({
        where: { barberId_serviceId: { barberId: dto.barberId, serviceId: dto.serviceId } },
      });
      if (!barberService) throw new BadRequestException('Este barbero no ofrece ese servicio');
    }

    const endTime = this.addMinutes(dto.startTime, bsService.durationMin);

    // Validate booking is in the future
    const now = new Date();
    const [year, month, day] = dto.date.split('-').map(Number);
    const [bh, bm] = dto.startTime.split(':').map(Number);
    const bookingDateTime = new Date(year, month - 1, day, bh, bm, 0, 0);
    if (bookingDateTime <= now) {
      throw new BadRequestException('No se puede reservar en un horario que ya paso');
    }

    const dateObj = new Date(dto.date);
    const startOfDay = new Date(dto.date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dto.date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Verificar que el barbero no tenga reserva en ese horario
    const barberConflict = await this.prisma.booking.findFirst({
      where: {
        barberId: dto.barberId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PENDIENTE', 'CONFIRMADA'] },
      },
    });

    if (barberConflict && this.overlaps(dto.startTime, endTime, barberConflict.startTime, barberConflict.endTime)) {
      throw new ConflictException('El barbero ya tiene una reserva en ese horario');
    }

    // Verificar que el usuario no tenga reserva en el mismo horario
    const userConflict = await this.prisma.booking.findFirst({
      where: {
        userId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PENDIENTE', 'CONFIRMADA'] },
      },
      include: { barber: { include: { barbershop: true } } },
    });

    if (userConflict && this.overlaps(dto.startTime, endTime, userConflict.startTime, userConflict.endTime)) {
      throw new ConflictException(
        `Ya tienes una reserva en ese horario en ${userConflict.barber.barbershop.name}`,
      );
    }

    const price = bsService.price;

    return this.prisma.booking.create({
      data: {
        userId,
        barberId: dto.barberId,
        serviceId: dto.serviceId,
        date: dateObj,
        startTime: dto.startTime,
        endTime,
        totalPrice: price,
        depositPrice: barber.barbershop.depositAmount,
        status: 'CONFIRMADA',
        notes: dto.notes,
      },
      include: {
        barber: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    });
  }

  async getMyBookings(userId: string, filters: BookingFiltersDto) {
    const { status, from, to, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (status) where.status = status;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          barber: { select: { firstName: true, lastName: true, barbershop: { select: { name: true } } } },
          service: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getBookingsByBarbershop(barbershopId: string, filters: BookingFiltersDto) {
    const { status, from, to, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { barber: { barbershopId } };

    if (status) where.status = status;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
          barber: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          payments: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        barber: { include: { barbershop: { select: { id: true, name: true, cancellationHours: true } } } },
        service: true,
        payments: true,
      },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    return booking;
  }

  async cancel(id: string, userId: string, userRoles: string[]) {
    const booking = await this.findOne(id);

    const isAdmin = userRoles.includes('ADMIN_GENERAL') ||
      userRoles.includes('ADMIN_BARBERSHOP') ||
      userRoles.includes('SUB_ADMIN');

    if (!isAdmin) {
      if (booking.userId !== userId) {
        throw new BadRequestException('No puedes cancelar esta reserva');
      }

      const cancellationHours = booking.barber.barbershop.cancellationHours;
      const bookingDateTime = new Date(booking.date);
      const [h, m] = booking.startTime.split(':').map(Number);
      bookingDateTime.setUTCHours(h, m, 0, 0);

      const hoursUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < cancellationHours) {
        throw new BadRequestException(
          `Solo puedes cancelar con al menos ${cancellationHours} horas de anticipacion`,
        );
      }
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: 'CANCELADA' },
    });
  }

  async createRecurring(userId: string, dto: CreateRecurringBookingDto) {
    const barber = await this.prisma.barber.findUnique({ where: { id: dto.barberId } });
    if (!barber) throw new NotFoundException('Barbero no encontrado');

    const bsService = await this.prisma.barbershopService.findUnique({
      where: { barbershopId_serviceId: { barbershopId: barber.barbershopId, serviceId: dto.serviceId } },
    });
    if (!bsService) throw new BadRequestException('Servicio no disponible en esta barberia');

    const endTime = this.addMinutes(dto.startTime, bsService.durationMin);

    const recurring = await this.prisma.recurringBooking.create({
      data: {
        userId,
        barberId: dto.barberId,
        serviceId: dto.serviceId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime,
      },
    });

    // Generar instancias para 4 semanas
    const dayMap: Record<string, number> = {
      DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3,
      JUEVES: 4, VIERNES: 5, SABADO: 6,
    };
    const targetDay = dayMap[dto.dayOfWeek];
    const today = new Date();
    const dates: Date[] = [];

    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() === targetDay) dates.push(d);
      if (dates.length >= 4) break;
    }

    for (const date of dates) {
      await this.prisma.booking.create({
        data: {
          userId,
          barberId: dto.barberId,
          serviceId: dto.serviceId,
          date,
          startTime: dto.startTime,
          endTime,
          totalPrice: bsService.price,
          status: 'CONFIRMADA',
          recurringBookingId: recurring.id,
          notes: dto.notes,
        },
      });
    }

    return recurring;
  }

  async excludeRecurringDate(recurringId: string, date: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        recurringBookingId: recurringId,
        date: new Date(date),
        status: { in: ['PENDIENTE', 'CONFIRMADA'] },
      },
    });

    for (const b of bookings) {
      await this.prisma.booking.update({ where: { id: b.id }, data: { status: 'CANCELADA' } });
    }

    return this.prisma.bookingException.create({
      data: { recurringBookingId: recurringId, excludedDate: new Date(date) },
    });
  }

  async cancelRecurring(recurringId: string) {
    await this.prisma.booking.updateMany({
      where: {
        recurringBookingId: recurringId,
        status: { in: ['PENDIENTE', 'CONFIRMADA'] },
        date: { gte: new Date() },
      },
      data: { status: 'CANCELADA' },
    });

    return this.prisma.recurringBooking.update({
      where: { id: recurringId },
      data: { isActive: false },
    });
  }

  async getMyRecurring(userId: string) {
    return this.prisma.recurringBooking.findMany({
      where: { userId, isActive: true },
      include: {
        bookings: { orderBy: { date: 'asc' }, take: 4 },
      },
    });
  }

  private addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60).toString().padStart(2, '0');
    const nm = (total % 60).toString().padStart(2, '0');
    return `${nh}:${nm}`;
  }

  private overlaps(s1: string, e1: string, s2: string, e2: string): boolean {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);
  }
}
