import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean, IsEnum, Min, Matches } from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreatePromotionDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsString()
    @Matches(/^[A-Z0-9]{4,20}$/, { message: 'كود الخصم يجب أن يكون 4-20 حرف أو رقم بالإنجليزية الكبيرة' })
    code: string;

    @IsEnum(DiscountType)
    discountType: DiscountType;

    @IsNumber()
    @Min(0)
    discountValue: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    usageLimit?: number;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;
}

export class UpdatePromotionDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    discountValue?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    usageLimit?: number;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class ValidatePromoCodeDto {
    @IsString()
    code: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    amount?: number;
}
