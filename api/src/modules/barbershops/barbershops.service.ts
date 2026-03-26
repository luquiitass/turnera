import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CloudflareService } from '../../common/cloudflare.service.js';
import {
  CreateBarbershopDto, UpdateBarbershopDto, AddBarbershopAdminDto, SearchBarbershopsQuery,
} from './dto/barbershops.dto.js';

@Injectable()
export class BarbershopsService {
  constructor(private prisma: PrismaService, private cloudflare: CloudflareService) {}

  async findAll(query: SearchBarbershopsQuery) {
    const { search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.barbershop.findMany({
        where,
        skip,
        take: limit,
        include: {
          amenities: { include: { amenity: true } },
          reviews: { select: { rating: true } },
          _count: { select: { barbers: true, services: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.barbershop.count({ where }),
    ]);

    const enriched = data.map((b) => {
      const ratings = b.reviews.map((r) => r.rating);
      const avgRating = ratings.length ? ratings.reduce((a, c) => a + c, 0) / ratings.length : 0;
      const { reviews, ...rest } = b;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10, totalReviews: ratings.length };
    });

    return { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const barbershop = await this.prisma.barbershop.findUnique({
      where: { id },
      include: {
        barbers: { where: { isActive: true }, include: { services: { include: { service: true } }, user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } } },
        services: { where: { isActive: true }, include: { service: true } },
        amenities: { include: { amenity: true } },
        reviews: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        paymentMethods: true,
        offers: { where: { isActive: true } },
      },
    });
    if (!barbershop) throw new NotFoundException('Barberia no encontrada');
    return barbershop;
  }

  async findBySlug(slug: string) {
    const barbershop = await this.prisma.barbershop.findUnique({
      where: { slug },
      include: {
        barbers: { where: { isActive: true }, include: { services: { include: { service: true } }, user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } } },
        services: { where: { isActive: true }, include: { service: true } },
        amenities: { include: { amenity: true } },
        reviews: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        paymentMethods: true,
        offers: { where: { isActive: true } },
      },
    });
    if (!barbershop) throw new NotFoundException('Barberia no encontrada');
    return barbershop;
  }

  async getMyBarbershops(userId: string) {
    const admins = await this.prisma.barbershopAdmin.findMany({
      where: { userId },
      include: {
        barbershop: {
          include: {
            _count: { select: { barbers: true, services: true } },
          },
        },
      },
    });
    return admins.map((a) => ({ ...a.barbershop, adminRole: a.role }));
  }

  async create(dto: CreateBarbershopDto) {
    const { adminEmail, ...barbershopData } = dto;

    // Find admin user by email
    const adminUser = await this.prisma.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser) throw new NotFoundException(`No existe un usuario con el email ${adminEmail}`);

    const existing = await this.prisma.barbershop.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Ya existe una barberia con ese nombre');

    // Generate slug
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slugExists = await this.prisma.barbershop.findUnique({ where: { slug } });
    const finalSlug = slugExists ? `${slug}-${Date.now().toString(36)}` : slug;

    // Create barbershop
    const barbershop = await this.prisma.barbershop.create({ data: { ...barbershopData, slug: finalSlug } });

    // Assign user as admin
    await this.prisma.barbershopAdmin.create({
      data: {
        userId: adminUser.id,
        barbershopId: barbershop.id,
        role: Role.ADMIN_BARBERSHOP,
      },
    });

    // Add ADMIN_BARBERSHOP role to user if not already present
    if (!adminUser.roles.includes(Role.ADMIN_BARBERSHOP)) {
      await this.prisma.user.update({
        where: { id: adminUser.id },
        data: { roles: { push: Role.ADMIN_BARBERSHOP } },
      });
    }

    // Register subdomain in Cloudflare Pages
    this.cloudflare.registerSubdomain(finalSlug).catch(() => {});

    return barbershop;
  }

  async update(id: string, dto: UpdateBarbershopDto) {
    await this.ensureExists(id);
    return this.prisma.barbershop.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.ensureExists(id);
    return this.prisma.barbershop.update({ where: { id }, data: { isActive: false } });
  }

  async addAdmin(barbershopId: string, dto: AddBarbershopAdminDto) {
    await this.ensureExists(barbershopId);
    return this.prisma.barbershopAdmin.create({
      data: {
        userId: dto.userId,
        barbershopId,
        role: dto.role || Role.SUB_ADMIN,
      },
    });
  }

  async removeAdmin(barbershopId: string, userId: string) {
    const admin = await this.prisma.barbershopAdmin.findUnique({
      where: { userId_barbershopId: { userId, barbershopId } },
    });
    if (!admin) throw new NotFoundException('Admin no encontrado');
    return this.prisma.barbershopAdmin.delete({ where: { id: admin.id } });
  }

  private async ensureExists(id: string) {
    const b = await this.prisma.barbershop.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Barberia no encontrada');
    return b;
  }
}
