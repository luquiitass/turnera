import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, IsArray, IsEmail } from 'class-validator';

export class CreateBarberDto {
  @IsUUID()
  barbershopId: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds?: string[];
}

export class UpdateBarberDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignServicesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];
}
