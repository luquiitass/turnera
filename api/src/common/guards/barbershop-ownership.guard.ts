import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class BarbershopOwnershipGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.roles?.includes(Role.ADMIN_GENERAL)) return true;

    const barbershopId =
      request.params.barbershopId ||
      request.body.barbershopId ||
      request.params.id;

    if (!barbershopId) return true;

    const admin = await this.prisma.barbershopAdmin.findUnique({
      where: {
        userId_barbershopId: {
          userId: user.id,
          barbershopId,
        },
      },
    });

    if (!admin) {
      throw new ForbiddenException('No tienes acceso a esta barberia');
    }

    return true;
  }
}
