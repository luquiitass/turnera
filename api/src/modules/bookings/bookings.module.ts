import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { BookingsController } from './bookings.controller.js';
import { PaymentsService } from '../payments/payments.service.js';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, PaymentsService],
  exports: [BookingsService],
})
export class BookingsModule {}
