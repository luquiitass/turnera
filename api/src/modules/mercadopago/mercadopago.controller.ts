import { Controller, Post, Get, Delete, Param, Body, Query, Redirect } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MercadoPagoService } from './mercadopago.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('mp')
export class MercadoPagoController {
  constructor(private mpService: MercadoPagoService) {}

  // ── Suscripción ───────────────────────────────────────────────

  @Post('subscriptions/:barbershopId')
  @Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL)
  subscribe(@Param('barbershopId') barbershopId: string, @Body('payerEmail') payerEmail: string) {
    return this.mpService.subscribeBarber(barbershopId, payerEmail);
  }

  @Get('subscriptions/:barbershopId/status')
  @Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL)
  subscriptionStatus(@Param('barbershopId') barbershopId: string) {
    return this.mpService.getSubscriptionStatus(barbershopId);
  }

  @Delete('subscriptions/:barbershopId')
  @Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL)
  cancelSubscription(@Param('barbershopId') barbershopId: string) {
    return this.mpService.cancelSubscription(barbershopId);
  }

  // ── Pago por reserva ──────────────────────────────────────────

  @Post('bookings/:bookingId/preference')
  @Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL, Role.USUARIO)
  createPreference(@Param('bookingId') bookingId: string) {
    return this.mpService.createBookingPreference(bookingId);
  }

  @Post('bookings/:bookingId/verify')
  @Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL, Role.USUARIO)
  verifyPayment(@Param('bookingId') bookingId: string) {
    return this.mpService.verifyBookingPayment(bookingId);
  }

  // ── OAuth MercadoPago (Marketplace) ──────────────────────────

  @Get('oauth/connect/:barbershopId')
  @Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL)
  getOAuthUrl(@Param('barbershopId') barbershopId: string) {
    const url = this.mpService.getOAuthUrl(barbershopId);
    return { url };
  }

  @Public()
  @Get('oauth/callback')
  async oauthCallback(@Query('code') code: string, @Query('state') barbershopId: string) {
    await this.mpService.exchangeOAuthCode(code, barbershopId);
    const appUrl = process.env.APP_URL ?? 'http://localhost:4200';
    return { redirect: `${appUrl}/admin/cuenta-bancaria?oauth=success&barbershopId=${barbershopId}` };
  }

  @Delete('oauth/disconnect/:barbershopId')
  @Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL)
  disconnectOAuth(@Param('barbershopId') barbershopId: string) {
    return this.mpService.disconnectOAuth(barbershopId);
  }

    // ── Reintento de transferencia fallida ───────────────────────

  @Post('transactions/:id/retry-transfer')
  @Roles(Role.ADMIN_GENERAL)
  retryTransfer(@Param('id') id: string) {
    return this.mpService.retryTransfer(id);
  }

  // ── Webhook (público — MP llama sin JWT) ──────────────────────

  @Public()
  @Post('webhook')
  webhook(@Query('type') type: string, @Body() body: any) {
    const dataId = body?.data?.id ?? body?.id;
    return this.mpService.handleWebhook(type, { id: dataId });
  }

  @Public()
  @Get('subscriptions/callback')
  subscriptionCallback(@Query() query: any) {
    return { message: 'Suscripción procesada', ...query };
  }
}
