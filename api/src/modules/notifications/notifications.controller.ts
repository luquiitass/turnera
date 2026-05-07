import { Controller, Get, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';
import { WhatsAppService } from './whatsapp.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UpdatePreferenceDto } from './dto/notifications.dto.js';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private svc: NotificationsService,
    private push: PushService,
    private whatsapp: WhatsAppService,
  ) {}

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findForUser(
      userId,
      unreadOnly === 'true',
      page ? +page : 1,
      limit ? +limit : 20,
    );
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.svc.countUnread(userId).then(count => ({ count }));
  }

  @Get('preferences')
  getPreferences(@CurrentUser('id') userId: string) {
    return this.svc.getPreferences(userId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.svc.markAllRead(userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.markRead(id, userId);
  }

  @Patch('preferences')
  upsertPreference(@CurrentUser('id') userId: string, @Body() dto: UpdatePreferenceDto) {
    const { type, ...rest } = dto;
    return this.svc.upsertPreference(userId, type as NotificationType, rest);
  }

  @Patch('push-token')
  registerToken(@CurrentUser('id') userId: string, @Body('token') token: string) {
    return this.push.registerToken(userId, token);
  }

  @Delete('push-token')
  removeToken(@CurrentUser('id') userId: string, @Body('token') token: string) {
    return this.push.removeToken(userId, token);
  }

  // ── Test de integración WhatsApp (solo desarrollo) ────────────────────────
  @Get('test-whatsapp')
  async testWhatsapp(@Query('phone') phone: string) {
    if (!phone) return { error: 'Parámetro ?phone requerido' };
    await this.whatsapp.sendText(phone, '🧪 *Test Turnera*\nNotificaciones WhatsApp funcionando correctamente.');
    return { ok: true, phone, provider: this.whatsapp['provider'], configured: this.whatsapp.isConfigured };
  }
}
