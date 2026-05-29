import {
  IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsInt, Min, IsEmail,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { BusinessModel, DepositType, Role } from '@prisma/client';

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
  @IsEnum(DepositType)
  depositType?: DepositType;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  maxBarberImages?: number;

}

export class UpdateBarbershopDto extends PartialType(CreateBarbershopDto) {}

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

export class NearbyBarbershopsQuery {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  radiusKm?: number = 5;
}

export class SearchByNameOrCityQuery {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
