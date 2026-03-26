import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getBarbershopDashboard(barbershopId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      bookingsToday, bookingsMonth, cancelledMonth,
      revenueToday, revenueMonth, activeBarbers, avgRating,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { barber: { barbershopId }, date: { gte: today, lt: tomorrow }, status: { not: 'CANCELADA' } },
      }),
      this.prisma.booking.count({
        where: { barber: { barbershopId }, date: { gte: startOfMonth }, status: { not: 'CANCELADA' } },
      }),
      this.prisma.booking.count({
        where: { barber: { barbershopId }, date: { gte: startOfMonth }, status: 'CANCELADA' },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { booking: { barber: { barbershopId }, date: { gte: today, lt: tomorrow } }, status: 'APROBADO' },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { booking: { barber: { barbershopId }, date: { gte: startOfMonth } }, status: 'APROBADO' },
      }),
      this.prisma.barber.count({ where: { barbershopId, isActive: true } }),
      this.prisma.review.aggregate({ _avg: { rating: true }, where: { barbershopId } }),
    ]);

    return {
      bookingsToday,
      revenueToday: revenueToday._sum.amount || 0,
      bookingsMonth,
      revenueMonth: revenueMonth._sum.amount || 0,
      cancelledMonth,
      activeBarbers,
      avgRating: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 10) / 10 : 0,
    };
  }

  async getBookingsByBarber(barbershopId: string, from?: string, to?: string) {
    const where: any = { barbershopId, isActive: true };
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const barbers = await this.prisma.barber.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true,
        _count: { select: { bookings: true } },
        bookings: {
          where: { status: { not: 'CANCELADA' }, ...(from || to ? { date: dateFilter } : {}) },
          select: { totalPrice: true },
        },
      },
    });

    return barbers.map((b) => ({
      barberId: b.id,
      barberName: `${b.firstName} ${b.lastName}`,
      totalBookings: b.bookings.length,
      totalRevenue: b.bookings.reduce((s, bk) => s + bk.totalPrice, 0),
    }));
  }

  async getRevenueByMethod(barbershopId: string, from?: string, to?: string) {
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'APROBADO',
        booking: {
          barber: { barbershopId },
          ...(from || to ? { date: dateFilter } : {}),
        },
      },
      select: { method: true, amount: true },
    });

    const byMethod: Record<string, number> = {};
    payments.forEach((p) => {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    });

    return Object.entries(byMethod).map(([method, total]) => ({ method, total }));
  }

  async getTopUsers(barbershopId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { barber: { barbershopId }, status: { not: 'CANCELADA' } },
      select: {
        userId: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const userCount: Record<string, { name: string; count: number }> = {};
    bookings.forEach((b) => {
      if (!userCount[b.userId]) {
        userCount[b.userId] = { name: `${b.user.firstName} ${b.user.lastName}`, count: 0 };
      }
      userCount[b.userId].count++;
    });

    return Object.entries(userCount)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  async getOccupancyByHour(barbershopId: string, from?: string, to?: string) {
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const bookings = await this.prisma.booking.findMany({
      where: {
        barber: { barbershopId },
        status: { not: 'CANCELADA' },
        ...(from || to ? { date: dateFilter } : {}),
      },
      select: { startTime: true },
    });

    const byHour: Record<string, number> = {};
    bookings.forEach((b) => {
      const hour = b.startTime.split(':')[0] + ':00';
      byHour[hour] = (byHour[hour] || 0) + 1;
    });

    return Object.entries(byHour)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  async getPlatformDashboard() {
    const [totalBarbershops, activeBarbershops, totalUsers, totalBookings, totalRevenue] =
      await Promise.all([
        this.prisma.barbershop.count(),
        this.prisma.barbershop.count({ where: { isActive: true } }),
        this.prisma.user.count(),
        this.prisma.booking.count(),
        this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'APROBADO' } }),
      ]);

    return {
      totalBarbershops,
      activeBarbershops,
      totalUsers,
      totalBookings,
      totalRevenue: totalRevenue._sum.amount || 0,
    };
  }
}
