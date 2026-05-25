import { Controller, Get, Put, Post, Param, Body, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service.js';
import { UpdateUserDto, AssignRoleDto } from './dto/users.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { PaginationQuery } from '../../common/types/pagination.js';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN_GENERAL)
  findAll(@Query() query: PaginationQuery) {
    return this.usersService.findAll(query);
  }

  @Get('dev/list')
  @Public()
  async getDevUsers() {
    // Endpoint solo para desarrollo - retorna usuarios sin autenticación
    // Acceso directo a la BD, sin pasar por el servicio
    const result = await this.usersService.findAll({ limit: 100, page: 1 });
    const data = (result as any).data;
    
    // Retornar directamente el array para el cliente
    return data.map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }));
  }

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Get('me/barbershops')
  getMyBarbershops(@CurrentUser('id') userId: string) {
    return this.usersService.getMyBarbershops(userId);
  }

  @Get(':id')
  @Roles(Role.ADMIN_GENERAL)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put('me')
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @Post('assign-role')
  @Roles(Role.ADMIN_GENERAL)
  assignRole(@Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(dto);
  }
}
