import { IsString, IsNotEmpty, IsOptional, IsNumber, IsInt, Min, IsUUID } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class AddServiceToBarbershopDto {
  @IsUUID()
  barbershopId: string;

  @IsUUID()
  serviceId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  @Min(10)
  durationMin: number;
}

export class UpdateBarbershopServiceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  durationMin?: number;
}
