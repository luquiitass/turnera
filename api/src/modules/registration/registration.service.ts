import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import * as crypto from 'crypto';

@Injectable()
export class RegistrationService {
  constructor(private prisma: PrismaService) {}

  async createOrder(expiresInDays = 7) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char code
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    return this.prisma.registrationOrder.create({
      data: { code, expiresAt },
    });
  }

  async listOrders() {
    return this.prisma.registrationOrder.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateCode(code: string) {
    const order = await this.prisma.registrationOrder.findUnique({ where: { code } });
    if (!order) throw new NotFoundException('Codigo de orden no valido');
    if (order.isUsed) throw new BadRequestException('Este codigo ya fue utilizado');
    if (order.expiresAt < new Date()) throw new BadRequestException('Este codigo ha expirado');
    return { valid: true, code: order.code, expiresAt: order.expiresAt };
  }

  async registerBarbershop(userId: string, code: string, data: {
    name: string; address: string; phone?: string; description?: string;
  }) {
    // Validate code
    const order = await this.prisma.registrationOrder.findUnique({ where: { code } });
    if (!order) throw new NotFoundException('Codigo de orden no valido');
    if (order.isUsed) throw new BadRequestException('Este codigo ya fue utilizado');
    if (order.expiresAt < new Date()) throw new BadRequestException('Este codigo ha expirado');

    // Check name unique
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existingName = await this.prisma.barbershop.findUnique({ where: { name: data.name } });
    if (existingName) throw new ConflictException('Ya existe una barberia con ese nombre');
    const existingSlug = await this.prisma.barbershop.findUnique({ where: { slug } });
    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    // Create barbershop
    const barbershop = await this.prisma.barbershop.create({
      data: {
        name: data.name,
        slug: finalSlug,
        address: data.address,
        phone: data.phone,
        description: data.description,
      },
    });

    // Assign user as admin
    await this.prisma.barbershopAdmin.create({
      data: { userId, barbershopId: barbershop.id, role: Role.ADMIN_BARBERSHOP },
    });

    // Add role to user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.roles.includes(Role.ADMIN_BARBERSHOP)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { roles: { push: Role.ADMIN_BARBERSHOP } },
      });
    }

    // Mark order as used
    await this.prisma.registrationOrder.update({
      where: { code },
      data: { isUsed: true, usedBy: userId, usedAt: new Date() },
    });

    return { barbershop, slug: finalSlug };
  }
}
