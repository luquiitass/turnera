import { Module } from '@nestjs/common';
import { MercadoPagoController } from './mercadopago.controller.js';
import { MercadoPagoService } from './mercadopago.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [MercadoPagoController],
  providers: [MercadoPagoService],
  exports: [MercadoPagoService],
})
export class MercadoPagoModule {}
