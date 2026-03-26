import {
  IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsInt, Min, IsEmail,
} from 'class-validator';
import { BusinessModel, Role } from '@prisma/client';

export class CreateBarbershopDto {
  @IsEmail()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cancellationHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minAdvanceHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAdvanceDays?: number;

  @IsOptional()
  @IsEnum(BusinessModel)
  businessModel?: BusinessModel;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxBarbers?: number;
}

export class UpdateBarbershopDto extends CreateBarbershopDto {}

export class AddBarbershopAdminDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class SearchBarbershopsQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  radiusKm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
