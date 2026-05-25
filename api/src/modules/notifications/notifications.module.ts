import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { PushService } from './push.service.js';
import { WhatsAppService } from './whatsapp.service.js';
import { NotificationDispatcher } from './notification-dispatcher.service.js';
import { ReminderSchedulerService } from './reminder-scheduler.service.js';
import { SseManagerService } from './sse-manager.service.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService, WhatsAppService, NotificationDispatcher, ReminderSchedulerService, SseManagerService],
  exports: [NotificationsService, PushService, WhatsAppService, NotificationDispatcher, SseManagerService],
})
export class NotificationsModule {}
