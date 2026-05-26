import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto/bank-account.dto.js';

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBankAccountDto) {
    const barbershop = await this.prisma.barbershop.findUnique({ where: { id: dto.barbershopId } });
    if (!barbershop) throw new NotFoundException('Barbería no encontrada');

    if (dto.accountType !== 'MP_OAUTH' && !dto.cbuCvu) {
      throw new BadRequestException('CBU/CVU requerido para este tipo de cuenta');
    }

    if (dto.isPrimary) {
      await this.prisma.barbershopBankAccount.updateMany({
        where: { barbershopId: dto.barbershopId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.barbershopBankAccount.create({ data: { ...dto } });
  }

  async findByBarbershop(barbershopId: string) {
    return this.prisma.barbershopBankAccount.findMany({
      where: { barbershopId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findPrimary(barbershopId: string) {
    return this.prisma.barbershopBankAccount.findFirst({
      where: { barbershopId, isPrimary: true, isActive: true },
    });
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    const account = await this.prisma.barbershopBankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    if (dto.isPrimary) {
      await this.prisma.barbershopBankAccount.updateMany({
        where: { barbershopId: account.barbershopId, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    }

    return this.prisma.barbershopBankAccount.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: string) {
    const account = await this.prisma.barbershopBankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    return this.prisma.barbershopBankAccount.update({
      where: { id },
      data: { isActive: false, isPrimary: false },
    });
  }

  async setPrimary(id: string) {
    const account = await this.prisma.barbershopBankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    await this.prisma.barbershopBankAccount.updateMany({
      where: { barbershopId: account.barbershopId, isPrimary: true },
      data: { isPrimary: false },
    });

    return this.prisma.barbershopBankAccount.update({
      where: { id },
      data: { isPrimary: true },
    });
  }

  async saveOAuthTokens(barbershopId: string, mpUserId: string, accessToken: string, refreshToken: string, expiresIn: number) {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const existing = await this.prisma.barbershopBankAccount.findFirst({
      where: { barbershopId, accountType: 'MP_OAUTH', isActive: true },
    });

    if (existing) {
      return this.prisma.barbershopBankAccount.update({
        where: { id: existing.id },
        data: { mpUserId, mpAccessToken: accessToken, mpRefreshToken: refreshToken, mpTokenExpiresAt: expiresAt },
      });
    }

    // Desactivar otras cuentas primarias si es la primera MP_OAUTH
    const hasPrimary = await this.prisma.barbershopBankAccount.findFirst({
      where: { barbershopId, isPrimary: true, isActive: true },
    });

    return this.prisma.barbershopBankAccount.create({
      data: {
        barbershopId,
        accountType: 'MP_OAUTH',
        mpUserId,
        mpAccessToken: accessToken,
        mpRefreshToken: refreshToken,
        mpTokenExpiresAt: expiresAt,
        holderName: 'Cuenta MercadoPago',
        isPrimary: !hasPrimary,
        isVerified: true,
      },
    });
  }
}
