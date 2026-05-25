import { Controller, Post, Get, Delete, Param, Body, Query, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { MercadoPagoService } from './mercadopago.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('mp')
export class MercadoPagoController {
  constructor(private mpService: MercadoPagoService) {}

  // ── Modelo 2: Suscripción ─────────────────────────────────

  @Post('subscriptions/:barbershopId')
  @Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL)
  subscribe(
    @Param('barbershopId') barbershopId: string,
    @Body('payerEmail') payerEmail: string,
  ) {
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

  // ── Modelo 3: Pago por reserva ────────────────────────────

  @Post('bookings/:bookingId/preference')
  createPreference(@Param('bookingId') bookingId: string) {
    return this.mpService.createBookingPreference(bookingId);
  }

  // ── Webhook (público — MP llama sin JWT) ──────────────────

  @Public()
  @Post('webhook')
  webhook(
    @Query('type') type: string,
    @Body() body: any,
  ) {
    const dataId = body?.data?.id ?? body?.id;
    return this.mpService.handleWebhook(type, { id: dataId });
  }

  // ── Callback redirect de suscripción ─────────────────────

  @Public()
  @Get('subscriptions/callback')
  subscriptionCallback(@Query() query: any) {
    return { message: 'Suscripción procesada', ...query };
  }
}
