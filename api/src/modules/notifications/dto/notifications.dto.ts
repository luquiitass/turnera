import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { NotificationType, NotificationEntityType } from '@prisma/client';

export class CreateNotificationDto {
  recipientIds!: string[];
  senderId?: string;
  title!: string;
  body!: string;
  type!: NotificationType;
  entityType?: NotificationEntityType;
  entityId?: string;
  actionUrl?: string;
  channels?: string[];
  priority?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  extraDataPerUser?: Record<string, any>;
}

export class QueryNotificationsDto {
  @IsOptional() unreadOnly?: boolean;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

export class UpdatePreferenceDto {
  @IsEnum(NotificationType) type!: NotificationType;
  @IsOptional() @IsBoolean() inApp?: boolean;
  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() whatsapp?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
}
