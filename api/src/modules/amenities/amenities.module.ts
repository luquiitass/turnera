import { Module } from '@nestjs/common';
import { AmenitiesService } from './amenities.service.js';
import { AmenitiesController } from './amenities.controller.js';

@Module({
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
