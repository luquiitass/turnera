import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsCleanupService } from './bookings-cleanup.service.js';
import { PaymentsService } from '../payments/payments.service.js';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, PaymentsService, BookingsCleanupService],
  exports: [BookingsService],
})
export class BookingsModule {}
