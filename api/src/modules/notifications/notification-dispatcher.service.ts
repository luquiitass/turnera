import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, NotificationEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';
import { WhatsAppService } from './whatsapp.service.js';

// Retorna true si el usuario tiene WhatsApp habilitado para ese tipo (default: true si no hay preferencia)
async function whatsappAllowed(
  prisma: PrismaService,
  userId: string | null | undefined,
  type: NotificationType,
): Promise<boolean> {
  if (!userId) return true;
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
    select: { whatsapp: true },
  });
  return pref?.whatsapp ?? true;
}

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private prisma: PrismaService,
    private notifSvc: NotificationsService,
    private push: PushService,
    private whatsapp: WhatsAppService,
  ) {}

  // ── Reserva creada → avisar admin y barbero ─────────────────────────────────
  async onBookingCreated(booking: {
    id: string; userId: string; barberId: string;
    date: Date; startTime: string; barber?: any; service?: any;
  }): Promise<void> {
    const [barber, client, bookingDetail] = await Promise.all([
      this.prisma.barber.findUnique({
        where: { id: booking.barberId },
        include: {
          user:      { select: { id: true, phone: true } },
          barbershop: { select: { id: true, name: true, address: true } },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: booking.userId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.booking.findUnique({
        where: { id: booking.id },
        select: { totalPrice: true, service: { select: { name: true } } },
      }),
    ]);
    if (!barber) { this.logger.warn(`Barber not found: ${booking.barberId}`); return; }

    const admins = await this.prisma.barbershopAdmin.findMany({
      where: { barbershopId: barber.barbershopId },
      include: { user: { select: { id: true, phone: true } } },
    });

    const date  = new Date(booking.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    const title = 'Nueva reserva';
    const body  = `${barber.barbershop?.name ?? 'Barbería'} — ${date} a las ${booking.startTime}`;

    const adminIds = admins.map(a => a.userId).filter(id => id !== booking.userId);
    const barberUserId = barber.user?.id && barber.user.id !== booking.userId
      ? barber.user.id : null;

    const recipientIds = [...new Set([...adminIds, ...(barberUserId ? [barberUserId] : [])])];

    this.logger.log(`Nueva reserva ${booking.id} → notificando a ${recipientIds.length} usuarios (admins: ${adminIds.length}, barbero: ${barberUserId ? 1 : 0})`);

    if (recipientIds.length === 0) {
      this.logger.warn('Sin destinatarios para NOT_RESERVA_NUEVA — los barberos no tienen cuenta de usuario vinculada');
    }

    const detailUrl = `/tabs/booking/${booking.id}`;
    const actionUrlPerUser: Record<string, string> = {};
    adminIds.forEach(id      => { actionUrlPerUser[id]          = detailUrl; });
    if (barberUserId)           { actionUrlPerUser[barberUserId] = detailUrl; }

    if (recipientIds.length > 0) {
      await this.notifSvc.create({
        recipientIds, senderId: booking.userId,
        title, body, type: NotificationType.NOT_RESERVA_NUEVA,
        entityType: NotificationEntityType.BOOKING, entityId: booking.id,
        actionUrl: detailUrl,
        actionUrlPerUser, channels: ['IN_APP'],
      });
      await this.push.sendToUsers(recipientIds, title, body, { bookingId: booking.id });
    }

    const barberPhone = barber.user?.phone ?? barber.phone;
    const barberWaOk = await whatsappAllowed(this.prisma, barber.user?.id, NotificationType.NOT_RESERVA_NUEVA);
    if (barberPhone && barberWaOk) {
      const clientName  = client ? `${client.firstName} ${client.lastName}` : 'Cliente';
      const serviceName = bookingDetail?.service?.name ?? 'Servicio';
      const price       = bookingDetail?.totalPrice ? `$${bookingDetail.totalPrice.toLocaleString('es-AR')}` : '';
      const msg = [
        `📅 *Nueva reserva*`,
        `👤 Cliente: ${clientName}`,
        `✂️ Servicio: ${serviceName}`,
        `📆 Fecha: ${date} a las ${booking.startTime}`,
        price ? `💰 Precio: ${price}` : '',
        `🏠 Barbería: ${barber.barbershop?.name}`,
      ].filter(Boolean).join('\n');
      await this.whatsapp.sendText(barberPhone, msg);
    }
  }

  // ── Reserva confirmada → avisar al cliente ───────────────────────────────────
  async onBookingConfirmed(booking: {
    id: string; userId: string; date: Date; startTime: string; barber?: any; service?: any;
  }): Promise<void> {
    const [client, full] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: booking.userId },
        select: { phone: true },
      }),
      this.prisma.booking.findUnique({
        where: { id: booking.id },
        select: {
          totalPrice: true,
          service: { select: { name: true } },
          barber: { select: { firstName: true, lastName: true, barbershop: { select: { name: true, address: true } } } },
        },
      }),
    ]);

    const date = new Date(booking.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    const title = 'Reserva confirmada ✓';
    const body = `Tu turno del ${date} a las ${booking.startTime} está confirmado.`;

    const detailUrl = `/tabs/booking/${booking.id}`;
    await this.notifSvc.create({
      recipientIds: [booking.userId], title, body,
      type: NotificationType.NOT_RESERVA_CONFIRMADA,
      entityType: NotificationEntityType.BOOKING, entityId: booking.id,
      actionUrl: detailUrl,
      actionUrlPerUser: { [booking.userId]: detailUrl },
      channels: ['IN_APP'],
    });

    await this.push.sendToUser(booking.userId, title, body, { bookingId: booking.id });

    const confirmedWaOk = await whatsappAllowed(this.prisma, booking.userId, NotificationType.NOT_RESERVA_CONFIRMADA);
    if (client?.phone && confirmedWaOk) {
      const barberName  = full?.barber ? `${full.barber.firstName} ${full.barber.lastName}` : '';
      const serviceName = full?.service?.name ?? '';
      const price       = full?.totalPrice ? `$${full.totalPrice.toLocaleString('es-AR')}` : '';
      const barbershop  = full?.barber?.barbershop;
      const msg = [
        `✅ *Reserva confirmada*`,
        serviceName   ? `✂️ Servicio: ${serviceName}` : '',
        barberName    ? `💈 Barbero: ${barberName}` : '',
        `📆 Fecha: ${date} a las ${booking.startTime}`,
        price         ? `💰 Precio: ${price}` : '',
        barbershop    ? `🏠 Barbería: ${barbershop.name}` : '',
        barbershop?.address ? `📍 ${barbershop.address}` : '',
        `\n¡Te esperamos!`,
      ].filter(Boolean).join('\n');
      await this.whatsapp.sendText(client.phone, msg);
    }
  }

  // ── Reserva cancelada → avisar cliente y barbero ────────────────────────────
  async onBookingCancelled(booking: {
    id: string; userId: string; barberId: string;
    date: Date; startTime: string; barber?: any;
  }, cancelledBy: string): Promise<void> {
    const [barber, client, bookingDetail, canceller] = await Promise.all([
      this.prisma.barber.findUnique({
        where: { id: booking.barberId },
        include: {
          user:      { select: { id: true, phone: true } },
          barbershop: { select: { id: true, name: true, address: true } },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: booking.userId },
        select: { phone: true },
      }),
      this.prisma.booking.findUnique({
        where: { id: booking.id },
        select: { service: { select: { name: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: cancelledBy },
        select: { firstName: true, lastName: true },
      }),
    ]);

    if (!barber) { this.logger.warn(`Barber not found: ${booking.barberId}`); return; }

    const admins = await this.prisma.barbershopAdmin.findMany({
      where: { barbershopId: barber.barbershopId },
      include: { user: { select: { id: true, phone: true } } },
    });

    const cancellerName = canceller ? `${canceller.firstName} ${canceller.lastName}` : 'Usuario';
    const date = new Date(booking.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    const title = 'Reserva cancelada';
    const body = `El turno del ${date} a las ${booking.startTime} fue cancelado por ${cancellerName}.`;

    // Admins: excluir al que canceló (si también es admin)
    const adminIds   = admins.map(a => a.userId).filter(id => id !== cancelledBy);
    // Barbero vinculado: excluir si es quien canceló
    const barbUserId = barber.user?.id && barber.user.id !== cancelledBy ? barber.user.id : null;

    this.logger.log(`Cancelación ${booking.id} → cliente: ${booking.userId}, admins: ${adminIds.length}, barbero: ${barbUserId ?? 'sin cuenta'}, canceló: ${cancelledBy}`);

    const recipientIds = [...new Set([
      booking.userId,
      ...adminIds,
      ...(barbUserId ? [barbUserId] : []),
    ])];

    const detailUrl = `/tabs/booking/${booking.id}`;
    const actionUrlPerUser: Record<string, string> = {
      [booking.userId]: detailUrl,
      ...adminIds.reduce((acc, id) => ({ ...acc, [id]: detailUrl }), {}),
      ...(barbUserId ? { [barbUserId]: detailUrl } : {}),
    };

    const extraDataPerUser: Record<string, any> = {
      [booking.userId]: { role: 'client' },
      ...adminIds.reduce((acc, id) => ({ ...acc, [id]: { role: 'admin' } }), {}),
      ...(barbUserId ? { [barbUserId]: { role: 'barber' } } : {}),
    };

    await this.notifSvc.create({
      recipientIds, senderId: cancelledBy, title, body,
      type: NotificationType.NOT_RESERVA_CANCELADA,
      entityType: NotificationEntityType.BOOKING, entityId: booking.id,
      actionUrl: detailUrl,
      actionUrlPerUser, extraDataPerUser, channels: ['IN_APP'],
    });

    await this.push.sendToUsers(recipientIds, title, body, { bookingId: booking.id });

    const serviceName = bookingDetail?.service?.name ?? '';
    const baseLines = [
      serviceName       ? `✂️ Servicio: ${serviceName}` : '',
      `📆 Fecha: ${date} a las ${booking.startTime}`,
      barber.barbershop ? `🏠 Barbería: ${barber.barbershop.name}` : '',
      `👤 Cancelado por: ${cancellerName}`,
    ].filter(Boolean);

    // WhatsApp al cliente
    const cancelledWaOk = await whatsappAllowed(this.prisma, booking.userId, NotificationType.NOT_RESERVA_CANCELADA);
    if (client?.phone && cancelledWaOk) {
      const msg = [`❌ *Turno cancelado*`, ...baseLines, `\nSi fue un error, creá un nuevo turno.`].join('\n');
      await this.whatsapp.sendText(client.phone, msg);
    }

    // WhatsApp al barbero (si no fue él quien canceló)
    const barberPhone = barber.user?.phone ?? barber.phone;
    const barberWaOk  = await whatsappAllowed(this.prisma, barber.user?.id, NotificationType.NOT_RESERVA_CANCELADA);
    if (barberPhone && barberWaOk && barber.user?.id !== cancelledBy) {
      const clientName = await this.prisma.user.findUnique({
        where: { id: booking.userId },
        select: { firstName: true, lastName: true },
      }).then(u => u ? `${u.firstName} ${u.lastName}` : 'Un cliente');
      const msg = [`❌ *Turno cancelado*`, `👤 Cliente: ${clientName}`, ...baseLines].join('\n');
      await this.whatsapp.sendText(barberPhone, msg);
    }
  }

  // ── Recordatorio 24h ──────────────────────────────────────────────────────────
  async sendReminder24h(booking: {
    id: string; userId: string; date: Date; startTime: string;
  }): Promise<void> {
    const [client, full] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: booking.userId },
        select: { phone: true },
      }),
      this.prisma.booking.findUnique({
        where: { id: booking.id },
        select: {
          service: { select: { name: true } },
          barber:  { select: { firstName: true, lastName: true, barbershop: { select: { name: true, address: true } } } },
        },
      }),
    ]);

    const date = new Date(booking.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    const title = 'Recordatorio de turno 🗓';
    const body = `Mañana tenés turno a las ${booking.startTime}.`;

    await this.notifSvc.create({
      recipientIds: [booking.userId], title, body,
      type: NotificationType.NOT_RESERVA_RECORDATORIO_24H,
      entityType: NotificationEntityType.BOOKING, entityId: booking.id,
      actionUrl: `/tabs/booking/${booking.id}`, channels: ['IN_APP'],
    });

    await this.push.sendToUser(booking.userId, title, body, { bookingId: booking.id });

    const reminderWaOk = await whatsappAllowed(this.prisma, booking.userId, NotificationType.NOT_RESERVA_RECORDATORIO_24H);
    if (client?.phone && reminderWaOk) {
      const barberName  = full?.barber ? `${full.barber.firstName} ${full.barber.lastName}` : '';
      const serviceName = full?.service?.name ?? '';
      const barbershop  = full?.barber?.barbershop;
      const msg = [
        `⏰ *Recordatorio de turno*`,
        `📆 Mañana: ${date} a las ${booking.startTime}`,
        serviceName   ? `✂️ Servicio: ${serviceName}` : '',
        barberName    ? `💈 Barbero: ${barberName}` : '',
        barbershop    ? `🏠 Barbería: ${barbershop.name}` : '',
        barbershop?.address ? `📍 ${barbershop.address}` : '',
      ].filter(Boolean).join('\n');
      await this.whatsapp.sendText(client.phone, msg);
    }
  }
}
