import { Module } from '@nestjs/common';
import { BarbersService } from './barbers.service.js';
import { BarbersController } from './barbers.controller.js';

@Module({
  controllers: [BarbersController],
  providers: [BarbersService],
  exports: [BarbersService],
})
export class BarbersModule {}
