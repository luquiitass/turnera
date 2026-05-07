import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationDispatcher } from './notification-dispatcher.service.js';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private dispatcher: NotificationDispatcher,
  ) {}

  // Todos los días a las 9 AM UTC
  @Cron('0 9 * * *')
  async sendDailyReminders(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

    const bookings = await this.prisma.booking.findMany({
      where: {
        date: { gte: tomorrow, lt: dayAfter },
        status: 'CONFIRMADA',
      },
    });

    this.logger.log(`Recordatorios 24h: ${bookings.length} reservas para mañana`);

    for (const booking of bookings) {
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          type: NotificationType.NOT_RESERVA_RECORDATORIO_24H,
          entityId: booking.id,
          entityType: 'BOOKING',
        },
      });
      if (alreadySent) continue;

      await this.dispatcher.sendReminder24h({
        id: booking.id,
        userId: booking.userId,
        date: booking.date,
        startTime: booking.startTime,
      }).catch(e => this.logger.error(`Error en recordatorio booking ${booking.id}`, e));
    }
  }
}
