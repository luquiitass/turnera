import { Injectable } from '@nestjs/common';
import { NotificationType, NotificationEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface CreateNotificationInput {
  recipientIds: string[];
  senderId?: string;
  title: string;
  body: string;
  type: NotificationType;
  entityType?: NotificationEntityType;
  entityId?: string;
  actionUrl?: string;                        // URL por defecto
  actionUrlPerUser?: Record<string, string>; // URL específica por userId (sobreescribe actionUrl)
  channels?: string[];
  priority?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  extraDataPerUser?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ── Crear notificación con múltiples destinatarios ────────────────────────
  async create(input: CreateNotificationInput) {
    const { recipientIds, senderId, title, body, type, entityType, entityId,
      actionUrl, actionUrlPerUser, channels, priority, expiresAt, metadata, extraDataPerUser } = input;

    const notification = await this.prisma.notification.create({
      data: {
        senderId,
        title, body, type,
        entityType, entityId, actionUrl,
        channels:  channels  ?? ['IN_APP'],
        priority:  priority  ?? 'NORMAL',
        expiresAt, metadata: metadata ?? {},
        recipients: {
          create: [...new Set(recipientIds)].map(userId => ({
            userId,
            extraData: {
              ...(extraDataPerUser?.[userId] ?? {}),
              // URL específica por rol — sobreescribe la URL base
              ...(actionUrlPerUser?.[userId] ? { actionUrl: actionUrlPerUser[userId] } : {}),
            },
          })),
        },
      },
      include: { recipients: true },
    });

    return notification;
  }

  // ── Listar notificaciones de un usuario ───────────────────────────────────
  async findForUser(userId: string, unreadOnly = false, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {
      userId,
      notification: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    };
    if (unreadOnly) where.isRead = false;

    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notificationUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          notification: {
            include: {
              sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.notificationUser.count({ where }),
      this.prisma.notificationUser.count({ where: { userId, isRead: false } }),
    ]);

    // Aplanar para que el frontend reciba un objeto limpio
    const data = rows.map(r => ({
      id:            r.id,
      notificationId: r.notificationId,
      userId:        r.userId,
      isRead:        r.isRead,
      readAt:        r.readAt,
      extraData:     r.extraData,
      deliveredAt:   r.deliveredAt,
      createdAt:     r.createdAt,
      // Campos de la notificación
      title:      r.notification.title,
      body:       r.notification.body,
      type:       r.notification.type,
      entityType: r.notification.entityType,
      entityId:   r.notification.entityId,
      actionUrl:  r.notification.actionUrl,
      channels:   r.notification.channels,
      priority:   r.notification.priority,
      metadata:   r.notification.metadata,
      sender:     r.notification.sender,
    }));

    return { data, total, unreadCount, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async countUnread(userId: string) {
    return this.prisma.notificationUser.count({ where: { userId, isRead: false } });
  }

  async markRead(notificationUserId: string, userId: string) {
    return this.prisma.notificationUser.updateMany({
      where: { id: notificationUserId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notificationUser.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ── Marcar como entregado en un canal ─────────────────────────────────────
  async markDelivered(notificationId: string, userId: string, channel: string) {
    const row = await this.prisma.notificationUser.findUnique({
      where: { notificationId_userId: { notificationId, userId } },
    });
    if (!row) return;
    const delivered: any = (row.deliveredAt as any) ?? {};
    delivered[channel] = new Date().toISOString();
    await this.prisma.notificationUser.update({
      where: { notificationId_userId: { notificationId, userId } },
      data: { deliveredAt: delivered },
    });
  }

  // ── Preferencias ──────────────────────────────────────────────────────────
  async getPreferences(userId: string) {
    const saved = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const types = Object.values(NotificationType);
    return types.map(type => {
      const pref = saved.find(p => p.type === type);
      return pref ?? { userId, type, inApp: true, push: true, whatsapp: true, email: false };
    });
  }

  async upsertPreference(
    userId: string,
    type: NotificationType,
    data: Partial<{ inApp: boolean; push: boolean; whatsapp: boolean; email: boolean }>,
  ) {
    return this.prisma.notificationPreference.upsert({
      where:  { userId_type: { userId, type } },
      create: { userId, type, inApp: true, push: true, whatsapp: true, email: false, ...data },
      update: data,
    });
  }
}
