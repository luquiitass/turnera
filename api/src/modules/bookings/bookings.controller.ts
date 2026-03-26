import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto, CreateRecurringBookingDto, BookingFiltersDto } from './dto/bookings.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(userId, dto);
  }

  @Get('my')
  getMyBookings(@CurrentUser('id') userId: string, @Query() filters: BookingFiltersDto) {
    return this.bookingsService.getMyBookings(userId, filters);
  }

  @Get('my/recurring')
  getMyRecurring(@CurrentUser('id') userId: string) {
    return this.bookingsService.getMyRecurring(userId);
  }

  @Get('barbershop/:barbershopId')
  @Roles(Role.ADMIN_BARBERSHOP, Role.SUB_ADMIN)
  getByBarbershop(@Param('barbershopId') barbershopId: string, @Query() filters: BookingFiltersDto) {
    return this.bookingsService.getBookingsByBarbershop(barbershopId, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookingsService.cancel(id, user.id, user.roles);
  }

  @Post('recurring')
  createRecurring(@CurrentUser('id') userId: string, @Body() dto: CreateRecurringBookingDto) {
    return this.bookingsService.createRecurring(userId, dto);
  }

  @Put('recurring/:id/exclude-date')
  excludeDate(@Param('id') id: string, @Body('date') date: string) {
    return this.bookingsService.excludeRecurringDate(id, date);
  }

  @Put('recurring/:id/cancel')
  cancelRecurring(@Param('id') id: string) {
    return this.bookingsService.cancelRecurring(id);
  }
}
