import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BankAccountsService } from './bank-accounts.service.js';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto/bank-account.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('bank-accounts')
@Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL)
export class BankAccountsController {
  constructor(private service: BankAccountsService) {}

  @Post()
  create(@Body() dto: CreateBankAccountDto) {
    return this.service.create(dto);
  }

  @Get('barbershop/:barbershopId')
  findByBarbershop(@Param('barbershopId') barbershopId: string) {
    return this.service.findByBarbershop(barbershopId);
  }

  @Get('barbershop/:barbershopId/primary')
  findPrimary(@Param('barbershopId') barbershopId: string) {
    return this.service.findPrimary(barbershopId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBankAccountDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/set-primary')
  setPrimary(@Param('id') id: string) {
    return this.service.setPrimary(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
