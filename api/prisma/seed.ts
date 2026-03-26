import { PrismaClient, Role, DayOfWeek, BookingStatus, PaymentMethodType, DiscountType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/barber_db';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // ==================== USERS ====================
  const password = await bcrypt.hash('123456', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@barber.app' },
    update: {},
    create: {
      email: 'admin@barber.app',
      password,
      firstName: 'Admin',
      lastName: 'General',
      phone: '+54 11 1234-5678',
      roles: [Role.ADMIN_GENERAL, Role.USUARIO],
    },
  });

  const adminBarbershop = await prisma.user.upsert({
    where: { email: 'barberia@barber.app' },
    update: {},
    create: {
      email: 'barberia@barber.app',
      password,
      firstName: 'Carlos',
      lastName: 'Gomez',
      phone: '+54 11 2345-6789',
      roles: [Role.ADMIN_BARBERSHOP, Role.USUARIO],
    },
  });

  const subAdmin = await prisma.user.upsert({
    where: { email: 'encargado@barber.app' },
    update: {},
    create: {
      email: 'encargado@barber.app',
      password,
      firstName: 'Lucas',
      lastName: 'Martinez',
      phone: '+54 11 3456-7890',
      roles: [Role.SUB_ADMIN, Role.USUARIO],
    },
  });

  const user1 = await prisma.user.upsert({
    where: { email: 'juan@email.com' },
    update: {},
    create: {
      email: 'juan@email.com',
      password,
      firstName: 'Juan',
      lastName: 'Perez',
      phone: '+54 11 4567-8901',
      roles: [Role.USUARIO],
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'maria@email.com' },
    update: {},
    create: {
      email: 'maria@email.com',
      password,
      firstName: 'Maria',
      lastName: 'Lopez',
      phone: '+54 11 5678-9012',
      roles: [Role.USUARIO],
    },
  });

  // ==================== AMENITIES (defaults) ====================
  const amenitiesData = [
    { name: 'Calefaccion', icon: 'flame-outline', category: 'Confort' },
    { name: 'Aire acondicionado', icon: 'snow-outline', category: 'Confort' },
    { name: 'WiFi', icon: 'wifi-outline', category: 'Servicios' },
    { name: 'Estacionamiento', icon: 'car-outline', category: 'Acceso' },
    { name: 'TV', icon: 'tv-outline', category: 'Entretenimiento' },
    { name: 'Musica', icon: 'musical-notes-outline', category: 'Entretenimiento' },
    { name: 'Cafe / Bebidas', icon: 'cafe-outline', category: 'Servicios' },
    { name: 'Accesibilidad', icon: 'accessibility-outline', category: 'Acceso' },
    { name: 'Bano', icon: 'water-outline', category: 'Servicios' },
    { name: 'Cargador celular', icon: 'battery-charging-outline', category: 'Servicios' },
  ];

  const amenities: any[] = [];
  for (const a of amenitiesData) {
    const amenity = await prisma.amenity.upsert({
      where: { name: a.name },
      update: {},
      create: { ...a, isDefault: true },
    });
    amenities.push(amenity);
  }

  // Helper to generate slug
  const toSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // ==================== BARBERSHOPS ====================
  const barbershop1 = await prisma.barbershop.upsert({
    where: { name: 'The Classic Cut' },
    update: {},
    create: {
      name: 'The Classic Cut',
      slug: toSlug('The Classic Cut'),
      description: 'Barberia clasica con estilo moderno. Cortes de primera calidad.',
      address: 'Av. Corrientes 1234, CABA',
      latitude: -34.6037,
      longitude: -58.3816,
      phone: '+54 11 4321-1234',
      depositAmount: 500,
      cancellationHours: 12,
      minAdvanceHours: 2,
      maxAdvanceDays: 30,
      maxBarbers: 5,
    },
  });

  const barbershop2 = await prisma.barbershop.upsert({
    where: { name: 'Urban Barber Studio' },
    update: {},
    create: {
      name: 'Urban Barber Studio',
      slug: toSlug('Urban Barber Studio'),
      description: 'Estilo urbano y tendencias actuales. Especializados en fades y disenos.',
      address: 'Av. Santa Fe 2345, CABA',
      latitude: -34.5956,
      longitude: -58.3985,
      phone: '+54 11 4321-5678',
      depositAmount: 300,
      cancellationHours: 6,
      minAdvanceHours: 1,
      maxAdvanceDays: 14,
      maxBarbers: 8,
    },
  });

  const barbershop3 = await prisma.barbershop.upsert({
    where: { name: 'Don Bigote' },
    update: {},
    create: {
      name: 'Don Bigote',
      slug: toSlug('Don Bigote'),
      description: 'Tradicion y calidad desde 1995. Barberia familiar.',
      address: 'Calle Rivadavia 567, CABA',
      latitude: -34.6083,
      longitude: -58.3712,
      phone: '+54 11 4321-9012',
      depositAmount: 0,
      cancellationHours: 24,
      minAdvanceHours: 3,
      maxAdvanceDays: 7,
      maxBarbers: 3,
    },
  });

  // ==================== BARBERSHOP ADMINS ====================
  await prisma.barbershopAdmin.upsert({
    where: { userId_barbershopId: { userId: adminBarbershop.id, barbershopId: barbershop1.id } },
    update: {},
    create: { userId: adminBarbershop.id, barbershopId: barbershop1.id, role: Role.ADMIN_BARBERSHOP },
  });

  await prisma.barbershopAdmin.upsert({
    where: { userId_barbershopId: { userId: subAdmin.id, barbershopId: barbershop1.id } },
    update: {},
    create: { userId: subAdmin.id, barbershopId: barbershop1.id, role: Role.SUB_ADMIN },
  });

  await prisma.barbershopAdmin.upsert({
    where: { userId_barbershopId: { userId: adminBarbershop.id, barbershopId: barbershop2.id } },
    update: {},
    create: { userId: adminBarbershop.id, barbershopId: barbershop2.id, role: Role.ADMIN_BARBERSHOP },
  });

  // ==================== BARBERSHOP AMENITIES ====================
  // The Classic Cut: calefaccion, wifi, tv, musica, cafe
  for (const idx of [0, 2, 4, 5, 6]) {
    await prisma.barbershopAmenity.upsert({
      where: { barbershopId_amenityId: { barbershopId: barbershop1.id, amenityId: amenities[idx].id } },
      update: {},
      create: { barbershopId: barbershop1.id, amenityId: amenities[idx].id },
    });
  }
  // Urban Barber: aire, wifi, musica, cargador
  for (const idx of [1, 2, 5, 9]) {
    await prisma.barbershopAmenity.upsert({
      where: { barbershopId_amenityId: { barbershopId: barbershop2.id, amenityId: amenities[idx].id } },
      update: {},
      create: { barbershopId: barbershop2.id, amenityId: amenities[idx].id },
    });
  }

  // ==================== PAYMENT METHODS ====================
  for (const bs of [barbershop1, barbershop2]) {
    for (const method of [PaymentMethodType.EFECTIVO, PaymentMethodType.TRANSFERENCIA]) {
      await prisma.barbershopPaymentMethod.upsert({
        where: { barbershopId_method: { barbershopId: bs.id, method } },
        update: {},
        create: { barbershopId: bs.id, method },
      });
    }
  }

  // ==================== SERVICES (GLOBAL CATALOG) ====================
  const servicesCatalog = [
    { name: 'Corte Clasico', category: 'Corte', description: 'Corte de cabello clasico con tijera y/o maquina' },
    { name: 'Corte + Barba', category: 'Combo', description: 'Combo corte de cabello y perfilado de barba' },
    { name: 'Barba', category: 'Barba', description: 'Perfilado y arreglo de barba' },
    { name: 'Corte Infantil', category: 'Corte', description: 'Corte para ninos' },
    { name: 'Cejas', category: 'Extras', description: 'Perfilado de cejas' },
    { name: 'Fade', category: 'Corte', description: 'Degradado clasico con maquina' },
    { name: 'Fade + Diseno', category: 'Corte', description: 'Degradado con diseno artistico' },
    { name: 'Color', category: 'Color', description: 'Coloracion de cabello' },
    { name: 'Alisado', category: 'Tratamiento', description: 'Alisado de cabello' },
    { name: 'Afeitada Clasica', category: 'Barba', description: 'Afeitada con navaja a la antigua' },
  ];

  const globalServices: any[] = [];
  for (const s of servicesCatalog) {
    const service = await prisma.service.upsert({
      where: { nameNormalized: s.name.toUpperCase() },
      update: {},
      create: { name: s.name, nameNormalized: s.name.toUpperCase(), category: s.category, description: s.description },
    });
    globalServices.push(service);
  }

  // Helper to find global service by name
  const svc = (name: string) => globalServices.find((s: any) => s.nameNormalized === name.toUpperCase());

  // ==================== BARBERSHOP SERVICES (prices per barbershop) ====================
  const bs1Services = [
    { serviceId: svc('Corte Clasico').id, price: 3500, durationMin: 30 },
    { serviceId: svc('Corte + Barba').id, price: 5000, durationMin: 45 },
    { serviceId: svc('Barba').id, price: 2000, durationMin: 20 },
    { serviceId: svc('Corte Infantil').id, price: 2500, durationMin: 20 },
    { serviceId: svc('Cejas').id, price: 800, durationMin: 10 },
  ];
  for (const s of bs1Services) {
    await prisma.barbershopService.create({ data: { barbershopId: barbershop1.id, ...s } });
  }

  const bs2Services = [
    { serviceId: svc('Fade').id, price: 4000, durationMin: 40 },
    { serviceId: svc('Fade + Diseno').id, price: 5500, durationMin: 60 },
    { serviceId: svc('Barba').id, price: 2500, durationMin: 25 },
    { serviceId: svc('Color').id, price: 8000, durationMin: 90 },
  ];
  for (const s of bs2Services) {
    await prisma.barbershopService.create({ data: { barbershopId: barbershop2.id, ...s } });
  }

  const bs3Services = [
    { serviceId: svc('Corte Clasico').id, price: 2500, durationMin: 30 },
    { serviceId: svc('Afeitada Clasica').id, price: 2000, durationMin: 30 },
    { serviceId: svc('Corte + Barba').id, price: 4000, durationMin: 50 },
  ];
  for (const s of bs3Services) {
    await prisma.barbershopService.create({ data: { barbershopId: barbershop3.id, ...s } });
  }

  // ==================== BARBERS ====================
  const barber1 = await prisma.barber.create({
    data: {
      barbershopId: barbershop1.id,
      firstName: 'Martin',
      lastName: 'Rodriguez',
      bio: '10 anos de experiencia en cortes clasicos y modernos.',
      phone: '+54 11 1111-1111',
    },
  });

  const barber2 = await prisma.barber.create({
    data: {
      barbershopId: barbershop1.id,
      firstName: 'Diego',
      lastName: 'Fernandez',
      bio: 'Especialista en barba y tratamientos faciales.',
      phone: '+54 11 2222-2222',
    },
  });

  const barber3 = await prisma.barber.create({
    data: {
      barbershopId: barbershop2.id,
      firstName: 'Facundo',
      lastName: 'Silva',
      bio: 'Experto en fades y disenos artisticos.',
      phone: '+54 11 3333-3333',
    },
  });

  const barber4 = await prisma.barber.create({
    data: {
      barbershopId: barbershop2.id,
      firstName: 'Nicolas',
      lastName: 'Torres',
      bio: 'Colorista profesional. Tendencias actuales.',
      phone: '+54 11 4444-4444',
    },
  });

  const barber5 = await prisma.barber.create({
    data: {
      barbershopId: barbershop3.id,
      firstName: 'Roberto',
      lastName: 'Sanchez',
      bio: 'Barbero desde 1995. La tradicion al servicio del cliente.',
      phone: '+54 11 5555-5555',
    },
  });

  // ==================== BARBER SERVICES ====================
  // Barber1 (Martin) - todos los servicios de barbershop1
  for (const s of bs1Services) {
    await prisma.barberService.create({ data: { barberId: barber1.id, serviceId: s.serviceId } });
  }
  // Barber2 (Diego) - barba, corte+barba, cejas
  for (const name of ['Barba', 'Corte + Barba', 'Cejas']) {
    await prisma.barberService.create({ data: { barberId: barber2.id, serviceId: svc(name).id } });
  }
  // Barber3 (Facundo) - fades
  for (const name of ['Fade', 'Fade + Diseno']) {
    await prisma.barberService.create({ data: { barberId: barber3.id, serviceId: svc(name).id } });
  }
  // Barber4 (Nicolas) - todos de barbershop2
  for (const s of bs2Services) {
    await prisma.barberService.create({ data: { barberId: barber4.id, serviceId: s.serviceId } });
  }
  // Barber5 (Roberto) - todos de barbershop3
  for (const s of bs3Services) {
    await prisma.barberService.create({ data: { barberId: barber5.id, serviceId: s.serviceId } });
  }

  // ==================== SCHEDULES ====================
  const weekdays = [DayOfWeek.LUNES, DayOfWeek.MARTES, DayOfWeek.MIERCOLES, DayOfWeek.JUEVES, DayOfWeek.VIERNES];
  const saturday = [DayOfWeek.SABADO];

  for (const barber of [barber1, barber2, barber3, barber4]) {
    for (const day of weekdays) {
      await prisma.schedule.upsert({
        where: { barberId_dayOfWeek: { barberId: barber.id, dayOfWeek: day } },
        update: {},
        create: { barberId: barber.id, dayOfWeek: day, openTime: '09:00', closeTime: '19:00', slotDurationMinutes: 30 },
      });
    }
    for (const day of saturday) {
      await prisma.schedule.upsert({
        where: { barberId_dayOfWeek: { barberId: barber.id, dayOfWeek: day } },
        update: {},
        create: { barberId: barber.id, dayOfWeek: day, openTime: '09:00', closeTime: '14:00', slotDurationMinutes: 30 },
      });
    }
  }

  // Barber5 (Roberto) - solo L-V
  for (const day of weekdays) {
    await prisma.schedule.upsert({
      where: { barberId_dayOfWeek: { barberId: barber5.id, dayOfWeek: day } },
      update: {},
      create: { barberId: barber5.id, dayOfWeek: day, openTime: '08:00', closeTime: '17:00', slotDurationMinutes: 30 },
    });
  }

  // ==================== BOOKINGS ====================
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  const booking1 = await prisma.booking.create({
    data: {
      userId: user1.id,
      barberId: barber1.id,
      serviceId: svc('Corte Clasico').id,
      date: tomorrow,
      startTime: '10:00',
      endTime: '10:30',
      totalPrice: 3500,
      depositPrice: 500,
      status: BookingStatus.CONFIRMADA,
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      userId: user2.id,
      barberId: barber1.id,
      serviceId: svc('Corte + Barba').id,
      date: tomorrow,
      startTime: '11:00',
      endTime: '11:45',
      totalPrice: 5000,
      depositPrice: 500,
      status: BookingStatus.CONFIRMADA,
    },
  });

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  await prisma.booking.create({
    data: {
      userId: user1.id,
      barberId: barber3.id,
      serviceId: svc('Fade').id,
      date: dayAfter,
      startTime: '15:00',
      endTime: '15:40',
      totalPrice: 4000,
      depositPrice: 300,
      status: BookingStatus.PENDIENTE,
    },
  });

  // ==================== PAYMENTS ====================
  await prisma.payment.create({
    data: {
      bookingId: booking1.id,
      amount: 500,
      method: PaymentMethodType.TRANSFERENCIA,
      type: 'SENA',
      status: 'APROBADO',
      registeredBy: adminBarbershop.id,
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking2.id,
      amount: 500,
      method: PaymentMethodType.EFECTIVO,
      type: 'SENA',
      status: 'APROBADO',
      registeredBy: subAdmin.id,
    },
  });

  // ==================== OFFERS ====================
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  await prisma.offer.create({
    data: {
      barbershopId: barbershop1.id,
      name: '20% OFF en Corte + Barba',
      description: 'Promo de bienvenida. Valido para nuevos clientes.',
      discountType: DiscountType.PORCENTAJE,
      discountValue: 20,
      validFrom: new Date(),
      validUntil: nextMonth,
      isActive: true,
    },
  });

  await prisma.offer.create({
    data: {
      barbershopId: barbershop2.id,
      serviceIds: [svc('Barba').id],
      appliesToAll: false,
      name: 'Barba gratis con tu primer Fade',
      description: 'Agenda un fade y lleva la barba sin cargo.',
      discountType: DiscountType.MONTO_FIJO,
      discountValue: 2500,
      validFrom: new Date(),
      validUntil: nextMonth,
      startTime: '09:00',
      endTime: '13:00',
      isActive: true,
    },
  });

  // ==================== REVIEWS ====================
  await prisma.review.upsert({
    where: { userId_barbershopId: { userId: user1.id, barbershopId: barbershop1.id } },
    update: {},
    create: {
      userId: user1.id,
      barbershopId: barbershop1.id,
      rating: 5,
      comment: 'Excelente atencion y corte impecable. Martin es un crack.',
    },
  });

  await prisma.review.upsert({
    where: { userId_barbershopId: { userId: user2.id, barbershopId: barbershop1.id } },
    update: {},
    create: {
      userId: user2.id,
      barbershopId: barbershop1.id,
      rating: 4,
      comment: 'Muy buena barberia, el ambiente es muy agradable.',
    },
  });

  await prisma.review.upsert({
    where: { userId_barbershopId: { userId: user1.id, barbershopId: barbershop2.id } },
    update: {},
    create: {
      userId: user1.id,
      barbershopId: barbershop2.id,
      rating: 5,
      comment: 'Los mejores fades de la zona. Facundo es un artista.',
    },
  });

  console.log('Seed completed successfully!');
  console.log('');
  console.log('Credenciales de prueba:');
  console.log('========================');
  console.log('Admin General:      admin@barber.app / 123456');
  console.log('Admin Barberia:     barberia@barber.app / 123456');
  console.log('Sub-admin:          encargado@barber.app / 123456');
  console.log('Usuario:            juan@email.com / 123456');
  console.log('Usuario:            maria@email.com / 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
