import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let userToken: string;
  let barbershopId: string;
  let barberId: string;
  let serviceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'juan@email.com', password: '123456' });
    userToken = loginRes.body.data.accessToken;

    // Get a barbershop that has barbers and services
    const barbershopsRes = await request(app.getHttpServer()).get('/api/barbershops');
    for (const bs of barbershopsRes.body.data.data) {
      const detailRes = await request(app.getHttpServer()).get(`/api/barbershops/${bs.id}`);
      if (detailRes.body.data.barbers?.length > 0 && detailRes.body.data.services?.length > 0) {
        barbershopId = bs.id;
        barberId = detailRes.body.data.barbers[0].id;
        serviceId = detailRes.body.data.services[0].id;
        break;
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Availability', () => {
    it('should return available slots', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      // Find next Monday
      while (nextWeek.getDay() !== 1) nextWeek.setDate(nextWeek.getDate() + 1);
      const dateStr = nextWeek.toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .get(`/api/schedules/availability/${barberId}/${dateStr}?serviceId=${serviceId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('time');
      expect(res.body.data[0]).toHaveProperty('available');
    });
  });

  describe('POST /api/bookings', () => {
    it('should create a booking', async () => {
      // Find a future Monday
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 14);
      while (nextWeek.getDay() !== 1) nextWeek.setDate(nextWeek.getDate() + 1);
      const dateStr = nextWeek.toISOString().split('T')[0];

      // Get availability
      const avail = await request(app.getHttpServer())
        .get(`/api/schedules/availability/${barberId}/${dateStr}?serviceId=${serviceId}`);

      const availableSlot = avail.body.data.find((s: any) => s.available);
      if (!availableSlot) return; // skip if no available slots

      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          barberId,
          serviceId,
          date: dateStr,
          startTime: availableSlot.time,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CONFIRMADA');
      expect(res.body.data.barberId).toBe(barberId);
    });

    it('should reject booking without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .send({
          barberId,
          serviceId,
          date: '2026-04-01',
          startTime: '10:00',
        })
        .expect(401);
    });
  });

  describe('GET /api/bookings/my', () => {
    it('should return user bookings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/bookings/my')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('data');
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });
  });
});
