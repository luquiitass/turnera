import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Amenities (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@barber.app', password: '123456' });
    adminToken = adminRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/amenities', () => {
    it('should list all amenities (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/amenities')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(10);

      const names = res.body.data.map((a: any) => a.name);
      expect(names).toContain('Calefaccion');
      expect(names).toContain('WiFi');
      expect(names).toContain('Aire acondicionado');
    });
  });

  describe('GET /api/amenities/barbershop/:id', () => {
    it('should return amenities for a barbershop', async () => {
      const barbershopsRes = await request(app.getHttpServer()).get('/api/barbershops');
      const barbershopId = barbershopsRes.body.data.data[0].id;

      const res = await request(app.getHttpServer())
        .get(`/api/amenities/barbershop/${barbershopId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/amenities (admin)', () => {
    it('should create a custom amenity', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/amenities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Custom Amenity ${Date.now()}`, icon: 'star-outline', category: 'Custom' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isDefault).toBe(false);
    });
  });

  describe('POST /api/amenities/toggle', () => {
    it('should toggle amenity for barbershop', async () => {
      const barbershopAdmin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'barberia@barber.app', password: '123456' });
      const bToken = barbershopAdmin.body.data.accessToken;

      const barbershopsRes = await request(app.getHttpServer()).get('/api/barbershops');
      const barbershopId = barbershopsRes.body.data.data[0].id;

      const amenitiesRes = await request(app.getHttpServer()).get('/api/amenities');
      const amenityId = amenitiesRes.body.data[amenitiesRes.body.data.length - 1].id;

      const res = await request(app.getHttpServer())
        .post('/api/amenities/toggle')
        .set('Authorization', `Bearer ${bToken}`)
        .send({ barbershopId, amenityId })
        .expect(201);

      expect(res.body.data.action).toMatch(/added|removed/);
    });
  });
});
