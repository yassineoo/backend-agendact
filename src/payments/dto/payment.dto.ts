import { IsString, IsOptional, IsNumber, IsEnum, IsUUID, IsDateString, Min, Max, IsInt } from 'class-validator';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
    @IsUUID()
    reservationId: string;

    @IsNumber()
    @Min(0)
    amount: number;

    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    promotionId?: string;
}

export class UpdatePaymentDto {
    @IsOptional()
    @IsEnum(PaymentStatus)
    status?: PaymentStatus;

    @IsOptional()
    @IsEnum(PaymentMethod)
    method?: PaymentMethod;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    transactionId?: string;
}

export class PaymentFilterDto {
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @IsOptional()
    @IsDateString()
    dateTo?: string;

    @IsOptional()
    @IsEnum(PaymentStatus)
    status?: PaymentStatus;

    @IsOptional()
    @IsEnum(PaymentMethod)
    method?: PaymentMethod;

    @IsOptional()
    @IsUUID()
    clientId?: string;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Min(10)
    @Max(100)
    limit?: number = 20;
}

export class ProcessRefundDto {
    @IsNumber()
    @Min(0)
    amount: number;

    @IsString()
    reason: string;
}
