import { Module } from '@nestjs/common';
import { OffersService } from './offers.service.js';
import { OffersController } from './offers.controller.js';

@Module({
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
