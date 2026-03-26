import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateReviewDto, UpdateReviewDto } from './dto/reviews.dto.js';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto) {
    const existing = await this.prisma.review.findUnique({
      where: { userId_barbershopId: { userId, barbershopId: dto.barbershopId } },
    });
    if (existing) throw new ConflictException('Ya dejaste una resena en esta barberia');

    return this.prisma.review.create({
      data: { userId, ...dto },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    });
  }

  async findByBarbershop(barbershopId: string) {
    return this.prisma.review.findMany({
      where: { barbershopId },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(barbershopId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { barbershopId },
      select: { rating: true },
    });

    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => { distribution[r.rating as keyof typeof distribution]++; });

    return {
      average: Math.round(avg * 10) / 10,
      total,
      distribution,
    };
  }

  async update(id: string, userId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Resena no encontrada');
    if (review.userId !== userId) throw new ForbiddenException('No puedes editar esta resena');

    return this.prisma.review.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string, userRoles: string[]) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Resena no encontrada');

    const isAdmin = userRoles.includes('ADMIN_GENERAL') || userRoles.includes('ADMIN_BARBERSHOP');
    if (review.userId !== userId && !isAdmin) {
      throw new ForbiddenException('No puedes eliminar esta resena');
    }

    return this.prisma.review.delete({ where: { id } });
  }
}
