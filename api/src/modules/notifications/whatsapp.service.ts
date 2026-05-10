import { Injectable, Logger } from '@nestjs/common';

// Normaliza números argentinos al formato WhatsApp: 549XXXXXXXXXX
function normalizeArgPhone(digits: string): string {
  if (!digits) return digits;
  if (digits.startsWith('549') && digits.length === 13) return digits;  // ya correcto
  if (digits.startsWith('54') && digits.length === 12) return `549${digits.slice(2)}`; // falta el 9
  if (digits.length === 10) return `549${digits}`;  // solo número local
  if (digits.length === 8 || digits.length === 7) return `5411${digits}`;  // número Capital sin área
  return digits; // otro país o formato desconocido — dejar como está
}

// Proveedor configurado via env:
// WHATSAPP_PROVIDER=evolution | meta | fonnte
//
// Evolution API (self-hosted):
//   EVOLUTION_API_URL=http://localhost:8081
//   EVOLUTION_API_KEY=turnera-evolution-key-2024
//   EVOLUTION_INSTANCE=turnera
//
// Meta Cloud API:
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
//
// Fonnte:
//   FONNTE_TOKEN

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly provider   = process.env['WHATSAPP_PROVIDER'] ?? 'evolution';
  // Evolution
  private readonly evolutionUrl      = process.env['EVOLUTION_API_URL'] ?? 'http://localhost:8081';
  private readonly evolutionApiKey   = process.env['EVOLUTION_API_KEY'] ?? '';
  private readonly evolutionInstance = process.env['EVOLUTION_INSTANCE'] ?? 'turnera';
  // Meta
  private readonly metaToken   = process.env['WHATSAPP_TOKEN'];
  private readonly metaPhoneId = process.env['WHATSAPP_PHONE_ID'];
  // Fonnte
  private readonly fonnteToken = process.env['FONNTE_TOKEN'];

  get isConfigured(): boolean {
    if (this.provider === 'evolution') return !!(this.evolutionApiKey && this.evolutionUrl);
    if (this.provider === 'fonnte')    return !!this.fonnteToken;
    return !!(this.metaToken && this.metaPhoneId);
  }

  async sendText(to: string, message: string): Promise<void> {
    if (!this.isConfigured || !to) return;
    const clean = normalizeArgPhone(to.replace(/\D/g, ''));
    if (!clean) return;

    try {
      if (this.provider === 'evolution') {
        await this.sendEvolution(clean, message);
      } else if (this.provider === 'fonnte') {
        await this.sendFonnte(clean, message);
      } else {
        await this.sendMeta(clean, message);
      }
    } catch (e) {
      this.logger.error(`WhatsApp [${this.provider}] send failed to ${clean}`, e);
    }
  }

  // ── Evolution API ─────────────────────────────────────────────────────────
  private async sendEvolution(to: string, message: string): Promise<void> {
    const url = `${this.evolutionUrl}/message/sendText/${this.evolutionInstance}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.evolutionApiKey,
      },
      body: JSON.stringify({
        number: to,
        text: message,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      this.logger.warn(`Evolution API error ${res.status}: ${body}`);
    } else {
      this.logger.log(`Evolution API sent to ${to}: ${res.status} ${body.slice(0, 80)}`);
    }
  }

  // ── Meta Cloud API ────────────────────────────────────────────────────────
  private async sendMeta(to: string, message: string): Promise<void> {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${this.metaPhoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.metaToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      this.logger.warn(`Meta WhatsApp error ${res.status}: ${err}`);
    }
  }

  // ── Fonnte ────────────────────────────────────────────────────────────────
  private async sendFonnte(to: string, message: string): Promise<void> {
    const body = new URLSearchParams({ target: to, message });
    const res = await fetch('https://fontee.io/api/send', {
      method: 'POST',
      headers: {
        Authorization: this.fonnteToken!,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      this.logger.warn(`Fonnte error ${res.status}: ${err}`);
    }
  }
}
