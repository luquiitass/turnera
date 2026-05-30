import {
  Injectable, Logger, NotFoundException, BadRequestException,
  ConflictException, ForbiddenException,
} from '@nestjs/common';
import { calcDeposit } from '../../common/utils/deposit.util.js';
import { DayOfWeek } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CreateBookingDto, CreateRecurringBookingDto, BookingFiltersDto } from './dto/bookings.dto.js';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private dispatcher: NotificationDispatcher,
    private paymentsService: PaymentsService,
  ) {}

  async create(userId: string, dto: CreateBookingDto, userRoles: string[] = []) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) throw new NotFoundException('Servicio no encontrado');

    const [barber, barbershop] = await Promise.all([
      this.prisma.barber.findUnique({ where: { id: dto.barberId } }),
      this.prisma.barbershop.findUnique({ where: { id: dto.barbershopId } }),
    ]);
    if (!barber)     throw new NotFoundException('Barbero no encontrado');
    if (!barbershop) throw new NotFoundException('Barbería no encontrada');

    // Validar que el barbero pertenece a la barbería indicada
    if (barber.barbershopId !== dto.barbershopId) {
      throw new BadRequestException('El barbero no pertenece a esta barbería');
    }

    // Get barbershop-specific price and duration
    const bsService = await this.prisma.barbershopService.findUnique({
      where: { barbershopId_serviceId: { barbershopId: dto.barbershopId, serviceId: dto.serviceId } },
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

    const depositPrice = calcDeposit((barbershop as any).depositType, barbershop.depositAmount, price);

    // Staff de la barbería (admin general, admin de barbería, sub-admin, o barbero
    // del mismo local) confirman directo sin necesidad de seña
    const isAdminRole = userRoles.some(r =>
      ['ADMIN_GENERAL', 'ADMIN_BARBERSHOP', 'SUB_ADMIN'].includes(r),
    );
    const isBarberOfShop = !isAdminRole && await this.prisma.barber.findFirst({
      where: { userId, barbershopId: dto.barbershopId, isActive: true },
    }).then(b => !!b);

    const isStaff = isAdminRole || isBarberOfShop;
    const requiresDeposit = !isStaff && depositPrice > 0;

    const booking = await this.prisma.booking.create({
      data: {
        userId,
        barberId: dto.barberId,
        serviceId: dto.serviceId,
        date: dateObj,
        startTime: dto.startTime,
        endTime,
        totalPrice: price,
        depositPrice,
        status: requiresDeposit ? 'PENDIENTE' : 'CONFIRMADA',
        notes: dto.notes,
      },
      include: {
        barber: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    });

    this.dispatcher.onBookingCreated({
      id: booking.id, userId, barberId: dto.barberId,
      date: dateObj, startTime: dto.startTime,
    }).catch(e => this.logger.error('Error en notificación de nueva reserva', e));

    return booking;
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
        barber: { include: { barbershop: { select: { id: true, name: true, address: true, latitude: true, longitude: true, phone: true, cancellationHours: true } } } },
        service: true,
        payments: true,
        cancelledBy: { select: { id: true, firstName: true, lastName: true } },
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

    // Verificar si el usuario es el barbero asignado a esta reserva
    const barberProfile = await this.prisma.barber.findFirst({
      where: { userId, id: booking.barberId },
    });
    const isBarberOfBooking = !!barberProfile;

    if (!isAdmin && !isBarberOfBooking) {
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

    const cancelled = await this.prisma.booking.update({
      where: { id },
      data: { status: 'CANCELADA', cancelledById: userId },
    });

    this.dispatcher.onBookingCancelled({
      id: booking.id, userId: booking.userId, barberId: booking.barberId,
      date: booking.date, startTime: booking.startTime,
      // No pasamos barber — el dispatcher lo carga fresco con todas las relaciones necesarias
    }, userId).catch(e => this.logger.error('Error en notificación de cancelación', e));

    return cancelled;
  }

  async updateStatus(id: string, status: string, userId: string, userRoles: string[]) {
    const allowed = ['CONFIRMADA', 'COMPLETADA', 'NO_SHOW', 'CANCELADA'];
    if (!allowed.includes(status)) throw new BadRequestException('Estado inválido');

    const booking = await this.findOne(id);

    const isAdmin = userRoles.includes('ADMIN_GENERAL') ||
      userRoles.includes('ADMIN_BARBERSHOP') ||
      userRoles.includes('SUB_ADMIN');

    if (!isAdmin) {
      // Verificar que sea el barbero asignado a esta reserva
      const barberProfile = await this.prisma.barber.findFirst({
        where: { userId, id: booking.barberId },
      });
      if (!barberProfile) throw new ForbiddenException('No tenés permiso para cambiar el estado de esta reserva');

      // Los barberos solo pueden marcar COMPLETADA o NO_SHOW
      if (!['COMPLETADA', 'NO_SHOW'].includes(status)) {
        throw new ForbiddenException('Los barberos solo pueden marcar como Completada o No Show');
      }
    }

    // COMPLETADA solo desde CONFIRMADA
    if (status === 'COMPLETADA' && booking.status !== 'CONFIRMADA') {
      throw new BadRequestException('Solo se puede completar una reserva que esté confirmada (seña paga)');
    }

    // NO_SHOW solo desde CONFIRMADA o PENDIENTE
    if (status === 'NO_SHOW' && !['CONFIRMADA', 'PENDIENTE'].includes(booking.status)) {
      throw new BadRequestException('No se puede marcar No Show en este estado');
    }

    // No se puede cambiar si ya está COMPLETADA o CANCELADA
    if (['COMPLETADA', 'CANCELADA'].includes(booking.status)) {
      throw new BadRequestException(`La reserva ya está ${booking.status.toLowerCase()} y no puede modificarse`);
    }

    const updated = await this.prisma.booking.update({ where: { id }, data: { status: status as any } });

    if (status === 'CONFIRMADA') {
      this.dispatcher.onBookingConfirmed({
        id: booking.id, userId: booking.userId,
        date: booking.date, startTime: booking.startTime,
      }).catch(e => this.logger.error('Error en notificación de confirmación', e));
    }

    // Al completar: crear movimiento SALDO pendiente automáticamente
    if (status === 'COMPLETADA') {
      this.paymentsService.createPendingSaldo(id, userId)
        .catch(e => this.logger.error('Error creando saldo pendiente', e));
    }

    return updated;
  }

  async createRecurring(userId: string, dto: CreateRecurringBookingDto) {
    const [barber, barbershop] = await Promise.all([
      this.prisma.barber.findUnique({ where: { id: dto.barberId } }),
      this.prisma.barbershop.findUnique({ where: { id: dto.barbershopId } }),
    ]);
    if (!barber)     throw new NotFoundException('Barbero no encontrado');
    if (!barbershop) throw new NotFoundException('Barbería no encontrada');

    if (barber.barbershopId !== dto.barbershopId) {
      throw new BadRequestException('El barbero no pertenece a esta barbería');
    }

    const bsService = await this.prisma.barbershopService.findUnique({
      where: { barbershopId_serviceId: { barbershopId: dto.barbershopId, serviceId: dto.serviceId } },
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

    const recurringDepositPrice = calcDeposit((barbershop as any).depositType, barbershop.depositAmount, bsService.price);
    const requiresDeposit = recurringDepositPrice > 0;

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
          depositPrice: recurringDepositPrice,
          status: requiresDeposit ? 'PENDIENTE' : 'CONFIRMADA',
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
