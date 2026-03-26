import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateAmenityDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ToggleBarbershopAmenityDto {
  @IsUUID()
  barbershopId: string;

  @IsUUID()
  amenityId: string;
}
