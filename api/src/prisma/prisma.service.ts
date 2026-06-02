import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/barber_db';
    // Railway internal network (.railway.internal) no requiere SSL
    // External connections (render, supabase, etc.) sí requieren SSL
    const needsSsl = connectionString.includes('.railway.internal')
      ? false
      : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
    const pool = new pg.Pool({
      connectionString,
      ssl: needsSsl,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
