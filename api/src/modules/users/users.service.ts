import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateUserDto, AssignRoleDto } from './dto/users.dto.js';
import { PaginationQuery } from '../../common/types/pagination.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationQuery) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, roles: true, isActive: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, address: true, avatarUrl: true, roles: true,
        isActive: true, createdAt: true,
        barbershopAdmins: {
          include: { barbershop: { select: { id: true, name: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, address: true, avatarUrl: true, roles: true,
      },
    });
  }

  async assignRole(dto: AssignRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.user.update({
      where: { email: dto.email },
      data: { roles: dto.roles },
      select: { id: true, email: true, firstName: true, lastName: true, roles: true },
    });
  }
}
