import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

// Tasas de comisión (porcentaje decimal)
const MP_FEE_RATE    = 0.0599; // 5.99% MercadoPago
const PLATFORM_RATE  = parseFloat(process.env['MP_PLATFORM_COMMISSION_RATE'] ?? '0.10');

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // ── Registrar pago manual (saldo en local) ────────────────────────────────
  async register(userId: string, dto: {
    bookingId: string; amount: number; method: string; type: string;
    notes?: string; paidAt?: string;
  }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { barber: { include: { barbershop: { select: { id: true } } } } },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const gross = dto.amount;
    const net   = gross; // pago en local sin comisiones

    return this.prisma.payment.create({
      data: {
        bookingId:    dto.bookingId,
        type:         dto.type as any,
        method:       dto.method as any,
        status:       'APROBADO',
        amount:       gross,
        grossAmount:  gross,
        mpFee:        0,
        platformFee:  0,
        netAmount:    net,
        notes:        dto.notes,
        paidAt:       dto.paidAt ? new Date(dto.paidAt) : new Date(),
        registeredBy: userId,
      },
      include: { booking: { include: { barber: true, service: true } }, register: { select: { firstName: true, lastName: true } } },
    });
  }

  // ── Crear pago desde MercadoPago (seña) ───────────────────────────────────
  async createFromMercadoPago(bookingId: string, mpPaymentId: string, grossAmount: number, isPlatformCommission: boolean) {
    const mpFee       = grossAmount * MP_FEE_RATE;
    const platformFee = isPlatformCommission ? grossAmount * PLATFORM_RATE : 0;
    const netAmount   = grossAmount - mpFee - platformFee;

    return this.prisma.payment.create({
      data: {
        bookingId,
        type:        'SENA',
        method:      'MERCADOPAGO',
        status:      'APROBADO',
        amount:      grossAmount,
        grossAmount,
        mpFee:       Math.round(mpFee * 100) / 100,
        platformFee: Math.round(platformFee * 100) / 100,
        netAmount:   Math.round(netAmount * 100) / 100,
        mpPaymentId,
        paidAt:      new Date(),
      },
    });
  }

  // ── Crear saldo pendiente al completar turno ──────────────────────────────
  async createPendingSaldo(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });
    if (!booking) return;

    const totalPaid = booking.payments
      .filter((p: any) => p.status === 'APROBADO')
      .reduce((s: number, p: any) => s + (p.netAmount || p.amount), 0);

    const remaining = booking.totalPrice - totalPaid;
    if (remaining <= 0.01) return; // ya pagó todo

    // Verificar que no haya un saldo pendiente ya creado
    const existingSaldo = booking.payments.find((p: any) => p.type === 'SALDO' && ['PENDIENTE','DEUDA'].includes(p.status));
    if (existingSaldo) return;

    return this.prisma.payment.create({
      data: {
        bookingId,
        type:        'SALDO',
        method:      'EFECTIVO',
        status:      'PENDIENTE',
        amount:      remaining,
        grossAmount: remaining,
        mpFee:       0,
        platformFee: 0,
        netAmount:   remaining,
        registeredBy: userId,
      },
    });
  }

  // ── Marcar saldo como pagado o deuda ──────────────────────────────────────
  async updateSaldo(paymentId: string, userId: string, data: {
    status: 'APROBADO' | 'DEUDA';
    amount?: number;
    method?: string;
    notes?: string;
  }) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.type !== 'SALDO') throw new BadRequestException('Solo se puede actualizar saldos');

    const gross = data.amount ?? payment.grossAmount ?? payment.amount;
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status:       data.status,
        method:       (data.method as any) ?? payment.method,
        amount:       gross,
        grossAmount:  gross,
        netAmount:    gross,
        notes:        data.notes,
        paidAt:       data.status === 'APROBADO' ? new Date() : null,
        registeredBy: userId,
      },
    });
  }

  // ── Obtener pagos de barbería por mes (para la activity) ──────────────────
  async getMonthlyByBarbershop(barbershopId: string, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0, 23, 59, 59);

    const payments = await this.prisma.payment.findMany({
      where: {
        booking: { barber: { barbershopId } },
        createdAt: { gte: from, lte: to },
      },
      include: {
        booking: {
          include: {
            user:    { select: { id: true, firstName: true, lastName: true } },
            barber:  { select: { id: true, firstName: true, lastName: true } },
            service: { select: { name: true } },
          },
        },
        register: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    // Agrupar por día
    const byDay = new Map<string, any[]>();
    for (const p of payments) {
      const dayKey = (p.paidAt ?? p.createdAt).toISOString().split('T')[0];
      if (!byDay.has(dayKey)) byDay.set(dayKey, []);
      byDay.get(dayKey)!.push(p);
    }

    const days = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        payments: items,
        totalGross:  items.reduce((s, p) => s + (p.grossAmount || p.amount), 0),
        totalNet:    items.reduce((s, p) => s + (p.netAmount   || p.amount), 0),
        totalDebt:   items.filter(p => p.status === 'DEUDA').reduce((s, p) => s + (p.grossAmount || p.amount), 0),
      }));

    const approved  = payments.filter(p => p.status === 'APROBADO');
    const debts     = payments.filter(p => p.status === 'DEUDA');
    const pending   = payments.filter(p => p.status === 'PENDIENTE');

    return {
      year, month,
      days,
      summary: {
        totalGross:  approved.reduce((s, p) => s + (p.grossAmount || p.amount), 0),
        totalNet:    approved.reduce((s, p) => s + (p.netAmount   || p.amount), 0),
        totalMpFee:  approved.reduce((s, p) => s + (p.mpFee || 0), 0),
        totalPlatformFee: approved.reduce((s, p) => s + (p.platformFee || 0), 0),
        totalDebt:   debts.reduce((s, p) => s + (p.grossAmount || p.amount), 0),
        totalPending: pending.reduce((s, p) => s + (p.grossAmount || p.amount), 0),
        countApproved: approved.length,
        countDebt:     debts.length,
        countPending:  pending.length,
      },
    };
  }

  // ── Resumen por reserva (sin cambios) ─────────────────────────────────────
  async getByBooking(bookingId: string) {
    return this.prisma.payment.findMany({
      where: { bookingId },
      include: { register: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSummary(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: { include: { register: { select: { firstName: true, lastName: true } } } },
        service: { select: { name: true } },
        barber:  { select: { firstName: true, lastName: true } },
      },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const totalPaid = booking.payments
      .filter((p: any) => p.status === 'APROBADO')
      .reduce((sum, p: any) => sum + (p.netAmount || p.amount), 0);

    return {
      booking: { id: booking.id, date: booking.date, startTime: booking.startTime,
        service: booking.service.name, barber: `${booking.barber.firstName} ${booking.barber.lastName}` },
      totalPrice: booking.totalPrice,
      depositPrice: booking.depositPrice,
      totalPaid,
      pending: Math.max(0, booking.totalPrice - totalPaid),
      payments: booking.payments,
    };
  }

  async refund(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return this.prisma.payment.update({ where: { id: paymentId }, data: { status: 'REEMBOLSADO' } });
  }
}
