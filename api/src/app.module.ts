import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { BarbershopsModule } from './modules/barbershops/barbershops.module.js';
import { BarbersModule } from './modules/barbers/barbers.module.js';
import { ServicesModule } from './modules/services/services.module.js';
import { SchedulesModule } from './modules/schedules/schedules.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { AmenitiesModule } from './modules/amenities/amenities.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { StatsModule } from './modules/stats/stats.module.js';
import { OffersModule } from './modules/offers/offers.module.js';
import { RegistrationModule } from './modules/registration/registration.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    BarbershopsModule,
    BarbersModule,
    ServicesModule,
    SchedulesModule,
    BookingsModule,
    PaymentsModule,
    AmenitiesModule,
    ReviewsModule,
    StatsModule,
    OffersModule,
    RegistrationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
