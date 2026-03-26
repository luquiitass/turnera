import {
  IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsUUID, IsDateString, IsBoolean, IsArray,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateOfferDto {
  @IsUUID()
  barbershopId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  discountValue: number;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validUntil: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsArray()
  serviceIds?: string[];

  @IsOptional()
  @IsArray()
  barberIds?: string[];

  @IsOptional()
  @IsBoolean()
  appliesToAll?: boolean;
}

export class UpdateOfferDto extends CreateOfferDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
