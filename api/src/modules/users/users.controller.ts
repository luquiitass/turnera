import { Controller, Get, Put, Post, Param, Body, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service.js';
import { UpdateUserDto, AssignRoleDto } from './dto/users.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PaginationQuery } from '../../common/types/pagination.js';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN_GENERAL)
  findAll(@Query() query: PaginationQuery) {
    return this.usersService.findAll(query);
  }

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findOne(userId);
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
