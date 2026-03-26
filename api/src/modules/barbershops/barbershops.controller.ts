import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BarbershopsService } from './barbershops.service.js';
import {
  CreateBarbershopDto, UpdateBarbershopDto, AddBarbershopAdminDto, SearchBarbershopsQuery,
} from './dto/barbershops.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { BarbershopOwnershipGuard } from '../../common/guards/barbershop-ownership.guard.js';

@Controller('barbershops')
export class BarbershopsController {
  constructor(private barbershopsService: BarbershopsService) {}

  @Public()
  @Get()
  findAll(@Query() query: SearchBarbershopsQuery) {
    return this.barbershopsService.findAll(query);
  }

  @Get('admin/my-barbershops')
  @Roles(Role.ADMIN_BARBERSHOP, Role.SUB_ADMIN)
  getMyBarbershops(@CurrentUser('id') userId: string) {
    return this.barbershopsService.getMyBarbershops(userId);
  }

  @Public()
  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.barbershopsService.findBySlug(slug);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.barbershopsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN_GENERAL)
  create(@Body() dto: CreateBarbershopDto) {
    return this.barbershopsService.create(dto);
  }

  @Put(':id')
  @Roles(Role.ADMIN_BARBERSHOP)
  @UseGuards(BarbershopOwnershipGuard)
  update(@Param('id') id: string, @Body() dto: UpdateBarbershopDto) {
    return this.barbershopsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_GENERAL)
  deactivate(@Param('id') id: string) {
    return this.barbershopsService.deactivate(id);
  }

  @Post(':id/admins')
  @Roles(Role.ADMIN_BARBERSHOP)
  @UseGuards(BarbershopOwnershipGuard)
  addAdmin(@Param('id') barbershopId: string, @Body() dto: AddBarbershopAdminDto) {
    return this.barbershopsService.addAdmin(barbershopId, dto);
  }

  @Delete(':id/admins/:userId')
  @Roles(Role.ADMIN_BARBERSHOP)
  @UseGuards(BarbershopOwnershipGuard)
  removeAdmin(@Param('id') barbershopId: string, @Param('userId') userId: string) {
    return this.barbershopsService.removeAdmin(barbershopId, userId);
  }
}
