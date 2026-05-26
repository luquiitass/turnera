import { IsString, IsOptional, IsBoolean, IsIn, IsNotEmpty, Length } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  barbershopId!: string;

  @IsIn(['CBU', 'CVU', 'MP_OAUTH'])
  accountType!: 'CBU' | 'CVU' | 'MP_OAUTH';

  @IsOptional()
  @IsString()
  @Length(22, 22, { message: 'El CBU/CVU debe tener exactamente 22 dígitos' })
  cbuCvu?: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  holderName?: string;

  @IsOptional()
  @IsString()
  holderCuit?: string;

  @IsOptional()
  @IsIn(['CAJA_AHORRO', 'CUENTA_CORRIENTE'])
  accountCategory?: 'CAJA_AHORRO' | 'CUENTA_CORRIENTE';

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  holderName?: string;

  @IsOptional()
  @IsString()
  holderCuit?: string;

  @IsOptional()
  @IsIn(['CAJA_AHORRO', 'CUENTA_CORRIENTE'])
  accountCategory?: 'CAJA_AHORRO' | 'CUENTA_CORRIENTE';

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
