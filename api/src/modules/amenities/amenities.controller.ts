import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AmenitiesService } from './amenities.service.js';
import { CreateAmenityDto, ToggleBarbershopAmenityDto } from './dto/amenities.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('amenities')
export class AmenitiesController {
  constructor(private amenitiesService: AmenitiesService) {}

  @Public()
  @Get()
  findAll() {
    return this.amenitiesService.findAll();
  }

  @Public()
  @Get('barbershop/:barbershopId')
  findByBarbershop(@Param('barbershopId') barbershopId: string) {
    return this.amenitiesService.findByBarbershop(barbershopId);
  }

  @Post()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN_BARBERSHOP)
  create(@Body() dto: CreateAmenityDto) {
    return this.amenitiesService.create(dto);
  }

  @Put(':id')
  @Roles(Role.ADMIN_GENERAL)
  update(@Param('id') id: string, @Body() dto: Partial<CreateAmenityDto>) {
    return this.amenitiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_GENERAL)
  remove(@Param('id') id: string) {
    return this.amenitiesService.remove(id);
  }

  @Post('toggle')
  @Roles(Role.ADMIN_BARBERSHOP)
  toggle(@Body() dto: ToggleBarbershopAmenityDto) {
    return this.amenitiesService.toggle(dto);
  }

  @Post('seed-defaults')
  @Roles(Role.ADMIN_GENERAL)
  seedDefaults() {
    return this.amenitiesService.seedDefaults();
  }
}
