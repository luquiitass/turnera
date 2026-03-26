import { Injectable, NotFoundException } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateScheduleDto, CreateBlockedSlotDto } from './dto/schedules.dto.js';

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

  async findByBarber(barberId: string) {
    return this.prisma.schedule.findMany({
      where: { barberId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async create(dto: CreateScheduleDto) {
    const { barberId, daysOfWeek, openTime, closeTime, slotDurationMinutes } = dto;

    const results: any[] = [];
    for (const day of daysOfWeek) {
      const schedule = await this.prisma.schedule.upsert({
        where: { barberId_dayOfWeek: { barberId, dayOfWeek: day } },
        update: { openTime, closeTime, slotDurationMinutes: slotDurationMinutes || 30 },
        create: { barberId, dayOfWeek: day, openTime, closeTime, slotDurationMinutes: slotDurationMinutes || 30 },
      });
      results.push(schedule);
    }
    return results;
  }

  async deleteSchedule(id: string) {
    return this.prisma.schedule.delete({ where: { id } });
  }

  async createBlock(dto: CreateBlockedSlotDto) {
    return this.prisma.blockedSlot.create({
      data: {
        barberId: dto.barberId,
        date: new Date(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
      },
    });
  }

  async deleteBlock(id: string) {
    return this.prisma.blockedSlot.delete({ where: { id } });
  }

  async getAvailability(barberId: string, date: string, serviceId?: string) {
    const dateObj = new Date(date);
    const dayIndex = dateObj.getUTCDay();
    const dayMap: DayOfWeek[] = [
      DayOfWeek.DOMINGO, DayOfWeek.LUNES, DayOfWeek.MARTES,
      DayOfWeek.MIERCOLES, DayOfWeek.JUEVES, DayOfWeek.VIERNES, DayOfWeek.SABADO,
    ];
    const dayOfWeek = dayMap[dayIndex];

    const schedule = await this.prisma.schedule.findUnique({
      where: { barberId_dayOfWeek: { barberId, dayOfWeek } },
    });
    if (!schedule) return [];

    let serviceDuration = schedule.slotDurationMinutes;
    if (serviceId) {
      const barber = await this.prisma.barber.findUnique({ where: { id: barberId }, select: { barbershopId: true } });
      if (barber) {
        const bsService = await this.prisma.barbershopService.findUnique({
          where: { barbershopId_serviceId: { barbershopId: barber.barbershopId, serviceId } },
        });
        if (bsService) serviceDuration = bsService.durationMin;
      }
    }

    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const [bookings, blocks] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          barberId,
          date: { gte: startOfDay, lte: endOfDay },
          status: { in: ['PENDIENTE', 'CONFIRMADA'] },
        },
        select: { startTime: true, endTime: true },
      }),
      this.prisma.blockedSlot.findMany({
        where: {
          barberId,
          date: { gte: startOfDay, lte: endOfDay },
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const slots = this.generateSlots(
      schedule.openTime,
      schedule.closeTime,
      serviceDuration,
    );

    // Check if the date is today to filter past slots
    const now = new Date();
    const isToday = dateObj.toISOString().split('T')[0] === now.toISOString().split('T')[0];
    const currentMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

    return slots
      .map((slot) => {
        const slotEnd = this.addMinutes(slot, serviceDuration);
        const slotMinutes = this.timeToMinutes(slot);
        const isPast = isToday && slotMinutes <= currentMinutes;
        const isBooked = bookings.some((b) => this.overlaps(slot, slotEnd, b.startTime, b.endTime));
        const isBlocked = blocks.some((b) => this.overlaps(slot, slotEnd, b.startTime, b.endTime));
        return {
          time: slot,
          endTime: slotEnd,
          available: !isPast && !isBooked && !isBlocked,
          isPast,
        };
      })
      .filter((slot) => !slot.isPast);
  }

  private generateSlots(open: string, close: string, durationMin: number): string[] {
    const slots: string[] = [];
    let current = this.timeToMinutes(open);
    const end = this.timeToMinutes(close);

    while (current + durationMin <= end) {
      slots.push(this.minutesToTime(current));
      current += durationMin;
    }
    return slots;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private addMinutes(time: string, minutes: number): string {
    return this.minutesToTime(this.timeToMinutes(time) + minutes);
  }

  private overlaps(s1: string, e1: string, s2: string, e2: string): boolean {
    const s1m = this.timeToMinutes(s1);
    const e1m = this.timeToMinutes(e1);
    const s2m = this.timeToMinutes(s2);
    const e2m = this.timeToMinutes(e2);
    return s1m < e2m && s2m < e1m;
  }
}
