import { Controller, Get, Param, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StatsService } from './stats.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('barbershop/:barbershopId/dashboard')
  @Roles(Role.ADMIN_BARBERSHOP)
  getDashboard(@Param('barbershopId') barbershopId: string) {
    return this.statsService.getBarbershopDashboard(barbershopId);
  }

  @Get('barbershop/:barbershopId/bookings-by-barber')
  @Roles(Role.ADMIN_BARBERSHOP)
  getBookingsByBarber(
    @Param('barbershopId') barbershopId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statsService.getBookingsByBarber(barbershopId, from, to);
  }

  @Get('barbershop/:barbershopId/revenue-by-method')
  @Roles(Role.ADMIN_BARBERSHOP)
  getRevenueByMethod(
    @Param('barbershopId') barbershopId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statsService.getRevenueByMethod(barbershopId, from, to);
  }

  @Get('barbershop/:barbershopId/top-users')
  @Roles(Role.ADMIN_BARBERSHOP)
  getTopUsers(@Param('barbershopId') barbershopId: string) {
    return this.statsService.getTopUsers(barbershopId);
  }

  @Get('barbershop/:barbershopId/occupancy-by-hour')
  @Roles(Role.ADMIN_BARBERSHOP)
  getOccupancyByHour(
    @Param('barbershopId') barbershopId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statsService.getOccupancyByHour(barbershopId, from, to);
  }

  @Get('platform/dashboard')
  @Roles(Role.ADMIN_GENERAL)
  getPlatformDashboard() {
    return this.statsService.getPlatformDashboard();
  }
}
