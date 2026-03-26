import { Controller, Post, Get, Put, Param, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PaymentsService } from './payments.service.js';
import { RegisterPaymentDto } from './dto/payments.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('register')
  @Roles(Role.ADMIN_BARBERSHOP, Role.SUB_ADMIN)
  register(@CurrentUser('id') userId: string, @Body() dto: RegisterPaymentDto) {
    return this.paymentsService.register(userId, dto);
  }

  @Get('booking/:bookingId')
  getByBooking(@Param('bookingId') bookingId: string) {
    return this.paymentsService.getByBooking(bookingId);
  }

  @Get('booking/:bookingId/summary')
  getSummary(@Param('bookingId') bookingId: string) {
    return this.paymentsService.getSummary(bookingId);
  }

  @Put(':id/refund')
  @Roles(Role.ADMIN_BARBERSHOP)
  refund(@Param('id') id: string) {
    return this.paymentsService.refund(id);
  }
}
