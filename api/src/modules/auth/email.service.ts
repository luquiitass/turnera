import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST   ?? 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT ?? '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      },
    });
  }

  get isConfigured(): boolean {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  async sendPasswordReset(email: string, token: string, appUrl: string): Promise<void> {
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
    const from = process.env.FROM_EMAIL ?? process.env.SMTP_USER ?? 'noreply@turnera.es';

    if (!this.isConfigured) {
      this.logger.warn(`Email no configurado. Link de reset para ${email}: ${resetUrl}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"Turnera" <${from}>`,
        to: email,
        subject: 'Recuperar contraseña — Turnera',
        html: this.buildResetTemplate(resetUrl),
        text: `Para restablecer tu contraseña ingresá al siguiente enlace (válido por 1 hora):\n\n${resetUrl}\n\nSi no solicitaste esto, ignorá este mensaje.`,
      });
      this.logger.log(`Email de reset enviado a ${email}`);
    } catch (e) {
      this.logger.error(`Error enviando email a ${email}`, e);
      throw e;
    }
  }

  private buildResetTemplate(resetUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperar contraseña</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#3880ff;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">✂️ Turnera</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">Recuperar contraseña</h2>
              <p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta.
                Hacé clic en el botón para crear una nueva contraseña.
                Este enlace es válido por <strong>1 hora</strong>.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#3880ff;border-radius:8px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">
                Si el botón no funciona, copiá este enlace en tu navegador:
              </p>
              <p style="margin:0;word-break:break-all;">
                <a href="${resetUrl}" style="color:#3880ff;font-size:13px;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Si no solicitaste este cambio, podés ignorar este mensaje. Tu contraseña no cambiará.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
