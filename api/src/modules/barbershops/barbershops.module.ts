import { Module } from '@nestjs/common';
import { BarbershopsService } from './barbershops.service.js';
import { BarbershopsController } from './barbershops.controller.js';

@Module({
  controllers: [BarbershopsController],
  providers: [BarbershopsService],
  exports: [BarbershopsService],
})
export class BarbershopsModule {}
