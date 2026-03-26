import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RegisterPaymentDto } from './dto/payments.dto.js';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async register(userId: string, dto: RegisterPaymentDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    return this.prisma.payment.create({
      data: {
        bookingId: dto.bookingId,
        amount: dto.amount,
        method: dto.method,
        type: dto.type,
        status: 'APROBADO',
        registeredBy: userId,
      },
    });
  }

  async getByBooking(bookingId: string) {
    return this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSummary(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: { include: { register: { select: { firstName: true, lastName: true } } } },
        service: { select: { name: true } },
        barber: { select: { firstName: true, lastName: true } },
      },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const totalPaid = booking.payments
      .filter((p) => p.status === 'APROBADO')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      booking: {
        id: booking.id,
        date: booking.date,
        startTime: booking.startTime,
        service: booking.service.name,
        barber: `${booking.barber.firstName} ${booking.barber.lastName}`,
      },
      totalPrice: booking.totalPrice,
      depositPrice: booking.depositPrice,
      totalPaid,
      pending: booking.totalPrice - totalPaid,
      payments: booking.payments,
    };
  }

  async refund(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REEMBOLSADO' },
    });
  }
}
