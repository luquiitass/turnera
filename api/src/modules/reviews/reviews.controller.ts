import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto, UpdateReviewDto } from './dto/reviews.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(userId, dto);
  }

  @Public()
  @Get('barbershop/:barbershopId')
  findByBarbershop(@Param('barbershopId') barbershopId: string) {
    return this.reviewsService.findByBarbershop(barbershopId);
  }

  @Public()
  @Get('barbershop/:barbershopId/stats')
  getStats(@Param('barbershopId') barbershopId: string) {
    return this.reviewsService.getStats(barbershopId);
  }

  @Put(':id')
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reviewsService.remove(id, user.id, user.roles);
  }
}
