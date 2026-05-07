import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly appId = process.env['ONESIGNAL_APP_ID'];
  private readonly apiKey = process.env['ONESIGNAL_API_KEY'];

  constructor(private prisma: PrismaService) {}

  get isConfigured(): boolean {
    return !!(this.appId && this.apiKey);
  }

  async registerToken(userId: string, token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pushTokens: true } });
    if (!user || user.pushTokens.includes(token)) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { pushTokens: { push: token } },
    });
  }

  async removeToken(userId: string, token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pushTokens: true } });
    if (!user) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { pushTokens: user.pushTokens.filter(t => t !== token) },
    });
  }

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, any>): Promise<void> {
    if (!this.isConfigured) return;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pushTokens: true } });
    if (!user?.pushTokens.length) return;

    await this.sendRaw({
      include_player_ids: user.pushTokens,
      headings: { en: title },
      contents: { en: body },
      data: data ?? {},
    });
  }

  async sendToUsers(userIds: string[], title: string, body: string, data?: Record<string, any>): Promise<void> {
    if (!this.isConfigured || !userIds.length) return;
    await Promise.all(userIds.map(id => this.sendToUser(id, title, body, data)));
  }

  private async sendRaw(payload: Record<string, any>): Promise<void> {
    try {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify({ app_id: this.appId, ...payload }),
      });
      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`OneSignal error ${res.status}: ${err}`);
      }
    } catch (e) {
      this.logger.error('Push send failed', e);
    }
  }
}
