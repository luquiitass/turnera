import {
  IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, IsEnum, IsInt, Min,
} from 'class-validator';
import { BookingStatus, DayOfWeek } from '@prisma/client';

export class CreateBookingDto {
  @IsUUID()
  barberId: string;

  @IsUUID()
  serviceId: string;

  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRecurringBookingDto {
  @IsUUID()
  barberId: string;

  @IsUUID()
  serviceId: string;

  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BookingFiltersDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
