import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Barbershops (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Login as admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@barber.app', password: '123456' });
    adminToken = adminRes.body.data.accessToken;

    // Login as user
    const userRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'juan@email.com', password: '123456' });
    userToken = userRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/barbershops', () => {
    it('should list barbershops without auth (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/barbershops')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.data[0]).toHaveProperty('name');
      expect(res.body.data.data[0]).toHaveProperty('avgRating');
    });

    it('should search barbershops by name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/barbershops?search=Classic')
        .expect(200);

      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].name).toContain('Classic');
    });
  });

  describe('GET /api/barbershops/:id', () => {
    it('should return barbershop detail with barbers and services', async () => {
      const listRes = await request(app.getHttpServer()).get('/api/barbershops');
      const barbershopId = listRes.body.data.data[0].id;

      const res = await request(app.getHttpServer())
        .get(`/api/barbershops/${barbershopId}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('barbers');
      expect(res.body.data).toHaveProperty('services');
      expect(res.body.data).toHaveProperty('amenities');
      expect(res.body.data).toHaveProperty('reviews');
    });
  });

  describe('POST /api/barbershops (admin only)', () => {
    it('should reject creation by regular user', async () => {
      await request(app.getHttpServer())
        .post('/api/barbershops')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'New Shop', address: 'Test St 123' })
        .expect(403);
    });

    it('should create barbershop as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/barbershops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Test Shop ${Date.now()}`, address: 'Test St 456' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
    });
  });
});
