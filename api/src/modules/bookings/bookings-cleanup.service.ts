import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class BookingsCleanupService {
  private readonly logger = new Logger(BookingsCleanupService.name);

  constructor(private prisma: PrismaService) {}

  // Corre cada 5 minutos — cancela reservas PENDIENTE sin pago dentro del timeout
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelStalePendingBookings(): Promise<void> {
    const timeoutMinutes = parseInt(process.env['PENDING_BOOKING_TIMEOUT_MINUTES'] ?? '30', 10);
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const stale = await this.prisma.booking.findMany({
      where: { status: 'PENDIENTE', createdAt: { lt: cutoff } },
      select: { id: true },
    });

    if (stale.length === 0) return;

    await this.prisma.booking.updateMany({
      where: { id: { in: stale.map(b => b.id) } },
      data: { status: 'CANCELADA' },
    });

    this.logger.log(`Auto-canceladas ${stale.length} reserva(s) PENDIENTE por falta de pago de seña (timeout: ${timeoutMinutes} min)`);
  }
}
