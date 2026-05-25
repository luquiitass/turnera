import { Controller, Post, Get, Put, Patch, Param, Body, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PaymentsService } from './payments.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('payments')
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  // ── Registrar pago manual ────────────────────────────────────────────────
  @Post('register')
  @Roles(Role.ADMIN_BARBERSHOP, Role.SUB_ADMIN, Role.ADMIN_GENERAL)
  register(
    @CurrentUser('id') userId: string,
    @Body() dto: { bookingId: string; amount: number; method: string; type: string; notes?: string; paidAt?: string },
  ) {
    return this.svc.register(userId, dto);
  }

  // ── Actualizar saldo (pagar o marcar deuda) ──────────────────────────────
  @Patch(':id/saldo')
  @Roles(Role.ADMIN_BARBERSHOP, Role.SUB_ADMIN, Role.ADMIN_GENERAL)
  updateSaldo(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: { status: 'APROBADO' | 'DEUDA'; amount?: number; method?: string; notes?: string },
  ) {
    return this.svc.updateSaldo(id, userId, dto);
  }

  // ── Pagos mensuales de barbería (activity) ───────────────────────────────
  @Get('barbershop/:id/monthly')
  @Roles(Role.ADMIN_BARBERSHOP, Role.SUB_ADMIN, Role.ADMIN_GENERAL)
  getMonthly(
    @Param('id') barbershopId: string,
    @Query('year')  year: string,
    @Query('month') month: string,
  ) {
    const now = new Date();
    return this.svc.getMonthlyByBarbershop(
      barbershopId,
      year  ? +year  : now.getFullYear(),
      month ? +month : now.getMonth() + 1,
    );
  }

  // ── Existentes ───────────────────────────────────────────────────────────
  @Get('booking/:bookingId')
  getByBooking(@Param('bookingId') id: string) { return this.svc.getByBooking(id); }

  @Get('booking/:bookingId/summary')
  getSummary(@Param('bookingId') id: string) { return this.svc.getSummary(id); }

  @Put(':id/refund')
  @Roles(Role.ADMIN_BARBERSHOP)
  refund(@Param('id') id: string) { return this.svc.refund(id); }
}
