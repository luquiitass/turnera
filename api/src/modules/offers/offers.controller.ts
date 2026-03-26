import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OffersService } from './offers.service.js';
import { CreateOfferDto, UpdateOfferDto } from './dto/offers.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('offers')
export class OffersController {
  constructor(private offersService: OffersService) {}

  @Public()
  @Get('barbershop/:barbershopId')
  findByBarbershop(@Param('barbershopId') barbershopId: string) {
    return this.offersService.findByBarbershop(barbershopId);
  }

  @Public()
  @Get('active')
  findActive() {
    return this.offersService.findActive();
  }

  @Post()
  @Roles(Role.ADMIN_BARBERSHOP)
  create(@Body() dto: CreateOfferDto) {
    return this.offersService.create(dto);
  }

  @Put(':id')
  @Roles(Role.ADMIN_BARBERSHOP)
  update(@Param('id') id: string, @Body() dto: Partial<UpdateOfferDto>) {
    return this.offersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_BARBERSHOP)
  deactivate(@Param('id') id: string) {
    return this.offersService.deactivate(id);
  }
}
