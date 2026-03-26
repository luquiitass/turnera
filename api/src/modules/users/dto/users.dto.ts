import { IsOptional, IsString, IsEmail, IsEnum, IsArray } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class AssignRoleDto {
  @IsEmail()
  email: string;

  @IsArray()
  @IsEnum(Role, { each: true })
  roles: Role[];
}
