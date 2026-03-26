import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RegistrationService } from './registration.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('registration')
export class RegistrationController {
  constructor(private registrationService: RegistrationService) {}

  @Post('create-order')
  @Roles(Role.ADMIN_GENERAL)
  createOrder(@Body('expiresInDays') expiresInDays?: number) {
    return this.registrationService.createOrder(expiresInDays || 7);
  }

  @Get('orders')
  @Roles(Role.ADMIN_GENERAL)
  listOrders() {
    return this.registrationService.listOrders();
  }

  @Public()
  @Get('validate/:code')
  validateCode(@Param('code') code: string) {
    return this.registrationService.validateCode(code);
  }

  @Post('register-barbershop')
  registerBarbershop(
    @CurrentUser('id') userId: string,
    @Body() body: { code: string; name: string; address: string; phone?: string; description?: string },
  ) {
    return this.registrationService.registerBarbershop(userId, body.code, body);
  }
}
