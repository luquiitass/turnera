import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ServicesService } from './services.service.js';
import { CreateServiceDto, UpdateServiceDto, AddServiceToBarbershopDto, UpdateBarbershopServiceDto } from './dto/services.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  // Global catalog
  @Public()
  @Get()
  findAll() {
    return this.servicesService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN_BARBERSHOP)
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Put(':id')
  @Roles(Role.ADMIN_GENERAL)
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_GENERAL)
  deactivate(@Param('id') id: string) {
    return this.servicesService.deactivate(id);
  }

  // Barbershop services
  @Public()
  @Get('barbershop/:barbershopId')
  findByBarbershop(@Param('barbershopId') barbershopId: string) {
    return this.servicesService.findByBarbershop(barbershopId);
  }

  @Post('barbershop')
  @Roles(Role.ADMIN_BARBERSHOP)
  addToBarbershop(@Body() dto: AddServiceToBarbershopDto) {
    return this.servicesService.addToBarbershop(dto);
  }

  @Put('barbershop/:id')
  @Roles(Role.ADMIN_BARBERSHOP)
  updateBarbershopService(@Param('id') id: string, @Body() dto: UpdateBarbershopServiceDto) {
    return this.servicesService.updateBarbershopService(id, dto);
  }

  @Delete('barbershop/:id')
  @Roles(Role.ADMIN_BARBERSHOP)
  removeFromBarbershop(@Param('id') id: string) {
    return this.servicesService.removeFromBarbershop(id);
  }
}
