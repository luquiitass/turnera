import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BarbershopsService } from './barbershops.service.js';
import {
  CreateBarbershopDto, UpdateBarbershopDto, AddBarbershopAdminDto, SearchBarbershopsQuery, NearbyBarbershopsQuery, SearchByNameOrCityQuery,
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

  @Get('admin/all')
  @Roles(Role.ADMIN_GENERAL)
  findAllAdmin() {
    return this.barbershopsService.findAllAdmin();
  }

  @Put(':id/activate')
  @Roles(Role.ADMIN_GENERAL)
  activate(@Param('id') id: string) {
    return this.barbershopsService.activate(id);
  }

  @Public()
  @Get('nearby')
  findNearby(@Query() query: NearbyBarbershopsQuery) {
    return this.barbershopsService.findNearby(query.latitude, query.longitude, query.radiusKm);
  }

  @Public()
  @Get('search-by-city/:city')
  searchByCity(@Param('city') city: string) {
    return this.barbershopsService.searchByCity(city);
  }

  @Public()
  @Get('search')
  search(@Query() query: any) {
    const { q, lat, lng, radius, limit } = query;
    return this.barbershopsService.search(q, lat, lng, radius, limit);
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

  /** Auto-registro: cualquier usuario autenticado puede dar de alta su barbería */
  @Post('self-register')
  selfRegister(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string,
    @Body() body: { name: string; address: string; phone?: string; description?: string; plan?: string },
  ) {
    return this.barbershopsService.selfRegister(userId, userEmail, body);
  }

  @Put(':id')
  @Roles(Role.ADMIN_BARBERSHOP)
  @UseGuards(BarbershopOwnershipGuard)
  update(@Param('id') id: string, @Body() dto: UpdateBarbershopDto) {
    return this.barbershopsService.update(id, dto);
  }

  @Patch(':id/slug')
  @Roles(Role.ADMIN_GENERAL)
  updateSlug(@Param('id') id: string, @Body('slug') slug: string | null) {
    return this.barbershopsService.updateSlug(id, slug ?? null);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_GENERAL)
  deactivate(@Param('id') id: string) {
    return this.barbershopsService.deactivate(id);
  }

  @Post(':id/images')
  @Roles(Role.ADMIN_BARBERSHOP)
  @UseGuards(BarbershopOwnershipGuard)
  addImage(@Param('id') barbershopId: string, @Body('imageId') imageId: string) {
    return this.barbershopsService.addImage(barbershopId, imageId);
  }

  @Delete(':id/images/:imageId')
  @Roles(Role.ADMIN_BARBERSHOP)
  @UseGuards(BarbershopOwnershipGuard)
  removeImage(@Param('id') barbershopId: string, @Param('imageId') imageId: string) {
    return this.barbershopsService.removeImage(barbershopId, imageId);
  }

  @Post(':id/subscription/comision')
  @Roles(Role.ADMIN_BARBERSHOP, Role.ADMIN_GENERAL)
  @UseGuards(BarbershopOwnershipGuard)
  activateComision(@Param('id') id: string) {
    return this.barbershopsService.activateComisionPlan(id);
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
