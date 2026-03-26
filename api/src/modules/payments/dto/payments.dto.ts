import { IsNumber, IsEnum, IsUUID, Min } from 'class-validator';
import { PaymentMethodType, PaymentType } from '@prisma/client';

export class RegisterPaymentDto {
  @IsUUID()
  bookingId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(PaymentMethodType)
  method: PaymentMethodType;

  @IsEnum(PaymentType)
  type: PaymentType;
}
