import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SchedulesService } from './schedules.service.js';
import { CreateScheduleDto, CreateBlockedSlotDto } from './dto/schedules.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('schedules')
export class SchedulesController {
  constructor(private schedulesService: SchedulesService) {}

  @Public()
  @Get('barber/:barberId')
  findByBarber(@Param('barberId') barberId: string) {
    return this.schedulesService.findByBarber(barberId);
  }

  @Post()
  @Roles(Role.ADMIN_BARBERSHOP)
  create(@Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_BARBERSHOP)
  deleteSchedule(@Param('id') id: string) {
    return this.schedulesService.deleteSchedule(id);
  }

  @Post('block')
  createBlock(@Body() dto: CreateBlockedSlotDto) {
    return this.schedulesService.createBlock(dto);
  }

  @Delete('block/:id')
  @Roles(Role.ADMIN_BARBERSHOP, Role.SUB_ADMIN)
  deleteBlock(@Param('id') id: string) {
    return this.schedulesService.deleteBlock(id);
  }

  @Public()
  @Get('availability/:barberId/:date')
  getAvailability(
    @Param('barberId') barberId: string,
    @Param('date') date: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.schedulesService.getAvailability(barberId, date, serviceId);
  }
}
