import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BarbersService } from './barbers.service.js';
import { CreateBarberDto, UpdateBarberDto, AssignServicesDto } from './dto/barbers.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { BarbershopOwnershipGuard } from '../../common/guards/barbershop-ownership.guard.js';

@Controller('barbers')
export class BarbersController {
  constructor(private barbersService: BarbersService) {}

  @Public()
  @Get('barbershop/:barbershopId')
  findByBarbershop(@Param('barbershopId') barbershopId: string) {
    return this.barbersService.findByBarbershop(barbershopId);
  }

  // Barber's own profile
  @Get('my-profile')
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.barbersService.findByUserId(userId);
  }

  @Put('my-profile')
  updateMyProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateBarberDto) {
    return this.barbersService.updateByUserId(userId, dto);
  }

  @Post('my-profile/images')
  addMyImage(@CurrentUser('id') userId: string, @Body('imageId') imageId: string) {
    return this.barbersService.addImageByUserId(userId, imageId);
  }

  @Delete('my-profile/images/:imageId')
  removeMyImage(@CurrentUser('id') userId: string, @Param('imageId') imageId: string) {
    return this.barbersService.removeImageByUserId(userId, imageId);
  }

  // Barber's upcoming bookings (next N days)
  @Get('my-upcoming-bookings')
  getMyUpcomingBookings(
    @CurrentUser('id') userId: string,
    @Query('barbershopId') barbershopId?: string,
    @Query('days') days?: string,
  ) {
    return this.barbersService.getBarberUpcomingBookings(userId, barbershopId, days ? +days : 30);
  }

  // Barber's agenda (bookings for a date)
  @Get('my-agenda/:date')
  getMyAgenda(
    @CurrentUser('id') userId: string,
    @Param('date') date: string,
    @Query('barbershopId') barbershopId?: string,
  ) {
    return this.barbersService.getBarberAgenda(userId, date, barbershopId);
  }

  // Barber's reviews
  @Get(':id/reviews')
  @Public()
  getBarberReviews(@Param('id') id: string) {
    return this.barbersService.getBarberReviews(id);
  }

  @Get(':id/reviews/stats')
  @Public()
  getBarberReviewStats(@Param('id') id: string) {
    return this.barbersService.getBarberReviewStats(id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.barbersService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN_BARBERSHOP)
  @UseGuards(BarbershopOwnershipGuard)
  create(@Body() dto: CreateBarberDto) {
    return this.barbersService.create(dto);
  }

  @Put(':id')
  @Roles(Role.ADMIN_BARBERSHOP)
  update(@Param('id') id: string, @Body() dto: UpdateBarberDto) {
    return this.barbersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_BARBERSHOP)
  deactivate(@Param('id') id: string) {
    return this.barbersService.deactivate(id);
  }

  @Put(':id/services')
  @Roles(Role.ADMIN_BARBERSHOP)
  assignServices(@Param('id') id: string, @Body() dto: AssignServicesDto) {
    return this.barbersService.assignServices(id, dto);
  }

  @Post(':id/images')
  @Roles(Role.ADMIN_BARBERSHOP)
  addImage(@Param('id') id: string, @Body('imageId') imageId: string) {
    return this.barbersService.addImage(id, imageId);
  }

  @Delete('images/:imageId')
  @Roles(Role.ADMIN_BARBERSHOP)
  removeImage(@Param('imageId') imageId: string) {
    return this.barbersService.removeImage(imageId);
  }
}
