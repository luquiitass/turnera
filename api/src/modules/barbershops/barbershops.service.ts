import {
  Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException,
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
          images: { include: { image: true } },
          amenities: { include: { amenity: true } },
          reviews: { select: { rating: true } },
          admins: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } } },
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

  async findAllAdmin() {
    const data = await this.prisma.barbershop.findMany({
      include: {
        images: { include: { image: true } },
        amenities: { include: { amenity: true } },
        reviews: { select: { rating: true } },
        admins: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } } },
        _count: { select: { barbers: true, services: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return data.map((b) => {
      const ratings = b.reviews.map((r) => r.rating);
      const avgRating = ratings.length ? ratings.reduce((a, c) => a + c, 0) / ratings.length : 0;
      const { reviews, ...rest } = b;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10, totalReviews: ratings.length };
    });
  }

  async activate(id: string) {
    await this.ensureExists(id);
    return this.prisma.barbershop.update({ where: { id }, data: { isActive: true } });
  }

  async findOne(id: string) {
    const barbershop = await this.prisma.barbershop.findUnique({
      where: { id },
      include: {
        barbers: { where: { isActive: true }, include: { services: { include: { service: true } }, user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }, images: { include: { image: true }, orderBy: { sortOrder: 'asc' as const } } } },
        images: { include: { image: true } },
        services: { where: { isActive: true }, include: { service: true } },
        amenities: { include: { amenity: true } },
        reviews: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        paymentMethods: true,
        offers: { where: { isActive: true } },
        subscription: true,
        admins: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });
    if (!barbershop || !barbershop.isActive) throw new NotFoundException('Barberia no encontrada');

    // Invariante: plan COMISION siempre debe tener depositType PERCENTAGE
    if (barbershop.businessModel === 'COMISION' && (barbershop as any).depositType !== 'PERCENTAGE') {
      await this.prisma.barbershop.update({ where: { id }, data: { depositType: 'PERCENTAGE' } });
      (barbershop as any).depositType = 'PERCENTAGE';
    }

    return barbershop;
  }

  async findBySlug(slug: string) {
    const barbershop = await this.prisma.barbershop.findUnique({
      where: { slug },
      include: {
        barbers: { where: { isActive: true }, include: { services: { include: { service: true } }, user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }, images: { include: { image: true }, orderBy: { sortOrder: 'asc' as const } } } },
        images: { include: { image: true } },
        services: { where: { isActive: true }, include: { service: true } },
        amenities: { include: { amenity: true } },
        reviews: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        paymentMethods: true,
        offers: { where: { isActive: true } },
        subscription: true,
        admins: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });
    if (!barbershop || !barbershop.isActive) throw new NotFoundException('Barberia no encontrada');
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

  async checkSlugAvailability(slug: string) {
    const normalized = slug.toLowerCase().trim();
    const valid = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(normalized);
    if (!valid) return { available: false, reason: 'Formato inválido (solo letras, números y guiones, mínimo 3 caracteres)' };

    const existing = await this.prisma.barbershop.findUnique({ where: { slug: normalized } });
    return { available: !existing, slug: normalized };
  }

  async selfRegister(
    userId: string,
    _userEmail: string,
    body: { name: string; address: string; slug?: string; phone?: string; description?: string; plan?: string },
  ) {
    // Validar duplicado: mismo nombre + misma dirección
    const existing = await this.prisma.barbershop.findFirst({
      where: {
        name: { equals: body.name, mode: 'insensitive' },
        address: { equals: body.address, mode: 'insensitive' },
      },
    });
    if (existing) throw new ConflictException('Ya existe una barbería con ese nombre en esa dirección');

    // Usar el slug enviado por el cliente (ya validado en el frontend) o generar uno
    let finalSlug: string;
    if (body.slug) {
      const normalized = body.slug.toLowerCase().trim();
      const slugTaken = await this.prisma.barbershop.findUnique({ where: { slug: normalized } });
      if (slugTaken) throw new ConflictException('El subdominio ya está en uso, elegí otro');
      finalSlug = normalized;
    } else {
      const base = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slugTaken = await this.prisma.barbershop.findUnique({ where: { slug: base } });
      finalSlug = slugTaken ? `${base}-${Date.now().toString(36)}` : base;
    }

    const barbershop = await this.prisma.barbershop.create({
      data: {
        name: body.name,
        address: body.address,
        phone: body.phone,
        description: body.description,
        slug: finalSlug,
      },
    });

    // Asignar el usuario actual como admin de la barbería
    await this.prisma.barbershopAdmin.create({
      data: { userId, barbershopId: barbershop.id, role: Role.ADMIN_BARBERSHOP },
    });

    // Agregar rol ADMIN_BARBERSHOP al usuario si no lo tiene
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.roles.includes(Role.ADMIN_BARBERSHOP)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { roles: { push: Role.ADMIN_BARBERSHOP } },
      });
    }

    // Crear suscripción según el plan seleccionado
    const plan = (body.plan ?? 'GRATUITO').toUpperCase();
    if (plan !== 'GRATUITO') {
      await this.prisma.barbershopSubscription.create({
        data: {
          barbershopId: barbershop.id,
          plan,
          startDate: new Date(),
          isActive: true,
          commissionRate: parseFloat(process.env['MP_PLATFORM_COMMISSION_RATE'] ?? '0.10'),
          minDepositRate: parseFloat(process.env['MP_MIN_DEPOSIT_RATE'] ?? '0.30'),
        },
      });
    }

    // Invariante: plan COMISION siempre requiere depositType PERCENTAGE
    if (plan === 'COMISION') {
      const defaultPct = parseFloat(process.env['MP_MIN_DEPOSIT_RATE'] ?? '0.30') * 100;
      await this.prisma.barbershop.update({
        where: { id: barbershop.id },
        data: { depositType: 'PERCENTAGE', depositAmount: defaultPct },
      });
    }

    // Registrar subdominio en Cloudflare solo para plan mensual (SUSCRIPCION)
    if (plan === 'SUSCRIPCION') {
      this.cloudflare.registerSubdomain(finalSlug).catch(() => {});
    }

    return { ...barbershop, slug: finalSlug };
  }

  async update(id: string, dto: UpdateBarbershopDto) {
    await this.ensureExists(id);

    // Plan COMISION: depositType siempre PERCENTAGE y no puede cambiarse
    if (dto.depositType && dto.depositType !== 'PERCENTAGE') {
      const bs = await this.prisma.barbershop.findUnique({
        where: { id },
        include: { subscription: { select: { plan: true } } },
      });
      if (bs?.subscription?.plan === 'COMISION') {
        throw new BadRequestException(
          'Con plan por comisión la seña debe ser porcentual. Cambiá el plan para usar monto fijo.',
        );
      }
    }

    return this.prisma.barbershop.update({ where: { id }, data: dto });
  }

  async updateSlug(id: string, slug: string | null) {
    await this.ensureExists(id);

    if (slug === null || slug === '') {
      // Remover subdominio: asignar slug vacío único para no romper la constraint UNIQUE
      const emptySlug = `disabled-${id.slice(0, 8)}`;
      return this.prisma.barbershop.update({ where: { id }, data: { slug: emptySlug } });
    }

    // Validar formato: solo letras minúsculas, números y guiones, 3-50 chars
    const valid = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
    if (!valid) {
      throw new BadRequestException(
        'El slug debe tener entre 3 y 50 caracteres, solo letras minúsculas, números y guiones, sin empezar ni terminar en guión.',
      );
    }

    // Verificar que no esté en uso por otra barbería
    const existing = await this.prisma.barbershop.findUnique({ where: { slug } });
    if (existing && existing.id !== id) {
      throw new ConflictException(`El subdominio "${slug}" ya está en uso.`);
    }

    const updated = await this.prisma.barbershop.update({ where: { id }, data: { slug } });

    // Registrar el nuevo subdominio en Cloudflare
    this.cloudflare.registerSubdomain(slug).catch(() => {});

    return updated;
  }

  async activateComisionPlan(barbershopId: string) {
    await this.ensureExists(barbershopId);

    const defaultDepositPct = parseFloat(process.env['MP_MIN_DEPOSIT_RATE'] ?? '0.30') * 100;

    // Forzar depositType = PERCENTAGE en la barbería al activar plan COMISION
    await this.prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        depositType: 'PERCENTAGE',
        // Si no tenía porcentaje configurado, poner el default del sistema
        depositAmount: await this.prisma.barbershop
          .findUnique({ where: { id: barbershopId }, select: { depositAmount: true } })
          .then(b => (b?.depositAmount ?? 0) > 0 ? b!.depositAmount : defaultDepositPct),
      },
    });

    return this.prisma.barbershopSubscription.upsert({
      where: { barbershopId },
      create: {
        barbershopId,
        plan: 'COMISION',
        startDate: new Date(),
        isActive: true,
        commissionRate: parseFloat(process.env['MP_PLATFORM_COMMISSION_RATE'] ?? '0.10'),
        minDepositRate: parseFloat(process.env['MP_MIN_DEPOSIT_RATE'] ?? '0.30'),
      },
      update: {
        plan: 'COMISION',
        isActive: true,
        commissionRate: parseFloat(process.env['MP_PLATFORM_COMMISSION_RATE'] ?? '0.10'),
        minDepositRate: parseFloat(process.env['MP_MIN_DEPOSIT_RATE'] ?? '0.30'),
      },
    });
  }

  async deactivate(id: string) {
    await this.ensureExists(id);
    return this.prisma.barbershop.update({ where: { id }, data: { isActive: false } });
  }

  async addImage(barbershopId: string, imageId: string) {
    await this.ensureExists(barbershopId);
    const image = await this.prisma.image.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Imagen no encontrada');

    if (image.type === 'ICONO' || image.type === 'PORTADA') {
      // Únicos por tipo — reemplaza el existente
      const existing = await this.prisma.barbershopImage.findFirst({
        where: { barbershopId, image: { type: image.type } },
      });
      if (existing) await this.prisma.barbershopImage.delete({ where: { id: existing.id } });
    } else if (image.type === 'GALERIA') {
      // Galería — valida límite maxBarberImages
      const barbershop = await this.prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { maxBarberImages: true },
      });
      const count = await this.prisma.barbershopImage.count({
        where: { barbershopId, image: { type: 'GALERIA' } },
      });
      const max = barbershop?.maxBarberImages ?? 3;
      if (count >= max) throw new BadRequestException(`Límite de ${max} imágenes de galería alcanzado`);
    }

    return this.prisma.barbershopImage.create({
      data: { barbershopId, imageId },
      include: { image: true },
    });
  }

  async removeImage(barbershopId: string, imageId: string) {
    const relation = await this.prisma.barbershopImage.findFirst({
      where: { barbershopId, imageId },
    });
    if (!relation) throw new NotFoundException('Imagen no encontrada en esta barbería');
    return this.prisma.barbershopImage.delete({ where: { id: relation.id } });
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
}

  /**
   * Buscar barberias cercanas por ubicación
   */
  async findNearby(lat: number, lng: number, radiusKm: number = 5) {
    if (!lat || !lng) {
      throw new Error('Latitud y longitud requeridas');
    }

    // Buscar todas las barberias activas con ubicación
    const allBarbershops = await this.prisma.barbershop.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      include: {
        images:    { include: { image: true } },
        amenities: { include: { amenity: true } },
        reviews:   { select: { rating: true } },
        _count:    { select: { barbers: true, services: true } },
      },
    });

    // Calcular distancias y filtrar
    const withDistance = allBarbershops
      .map((b) => {
        const distance = this.calculateDistance(lat, lng, b.latitude!, b.longitude!);
        const ratings = b.reviews.map((r) => r.rating);
        const avgRating = ratings.length ? ratings.reduce((a, c) => a + c, 0) / ratings.length : 0;
        const { reviews, ...rest } = b;
        return {
          ...rest,
          distance: Math.round(distance * 100) / 100,
          avgRating: Math.round(avgRating * 10) / 10,
          totalReviews: ratings.length,
        };
      })
      .filter((b) => b.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return withDistance;
  }

  /**
   * Buscar barberias por ciudad
   */
  async searchByCity(city: string, limit: number = 20) {
    const where: any = {
      isActive: true,
    };

    if (city && city.trim()) {
      where.address = { contains: city, mode: 'insensitive' };
    }

    const data = await this.prisma.barbershop.findMany({
      where,
      take: limit,
      include: {
        images:    { include: { image: true } },
        amenities: { include: { amenity: true } },
        reviews:   { select: { rating: true } },
        _count:    { select: { barbers: true, services: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return data.map((b) => {
      const ratings = b.reviews.map((r) => r.rating);
      const avgRating = ratings.length ? ratings.reduce((a, c) => a + c, 0) / ratings.length : 0;
      const { reviews, ...rest } = b;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10, totalReviews: ratings.length };
    });
  }

  /**
   * Búsqueda combinada: nombre + ciudad + ubicación
   */
  async search(query: string, lat?: number, lng?: number, radiusKm?: number, limit: number = 20) {
    // Si tiene ubicación y radio, buscar por proximidad
    if (lat && lng && radiusKm) {
      return this.findNearby(lat, lng, radiusKm);
    }

    // Si no, buscar por nombre o ciudad
    const where: any = { isActive: true };

    if (query && query.trim()) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
        // Buscar por nombre de servicio que ofrece la barbería
        { services: { some: { service: { name: { contains: query, mode: 'insensitive' } } } } },
      ];
    }

    const data = await this.prisma.barbershop.findMany({
      where,
      take: limit,
      include: {
        images:    { include: { image: true } },
        amenities: { include: { amenity: true } },
        reviews:   { select: { rating: true } },
        _count:    { select: { barbers: true, services: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return data.map((b) => {
      const ratings = b.reviews.map((r) => r.rating);
      const avgRating = ratings.length ? ratings.reduce((a, c) => a + c, 0) / ratings.length : 0;
      const { reviews, ...rest } = b;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10, totalReviews: ratings.length };
    });
  }

  /**
   * Calcular distancia Haversine entre dos puntos
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async ensureExists(id: string) {
    const b = await this.prisma.barbershop.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Barberia no encontrada');
    return b;
  }
}
