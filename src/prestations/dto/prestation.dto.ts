import { IsString, IsOptional, IsNumber, IsBoolean, IsInt, IsEnum, IsArray, IsUUID, Min, Max, MinLength, MaxLength, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleClass } from '@prisma/client';

export class CreatePrestationDto {
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @IsEnum(VehicleClass)
    vehicleClass: VehicleClass;

    @IsInt()
    @Min(5)
    @Max(480)
    duration: number;

    @IsNumber()
    @Min(0)
    price: number;

    @IsOptional()
    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid HEX format' })
    color?: string;

    @IsOptional()
    @IsString()
    icon?: string;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    visibleOnWeb?: boolean;

    @IsOptional()
    @IsString()
    webName?: string;

    @IsOptional()
    @IsString()
    webDescription?: string;

    @IsOptional()
    @IsBoolean()
    displayPrice?: boolean;

    @IsOptional()
    @IsBoolean()
    forceOnlinePayment?: boolean;

    @IsOptional()
    @IsBoolean()
    forceOnlineRepayment?: boolean;

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    categoryIds?: string[];
}

export class UpdatePrestationDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @IsOptional()
    @IsEnum(VehicleClass)
    vehicleClass?: VehicleClass;

    @IsOptional()
    @IsInt()
    @Min(5)
    @Max(480)
    duration?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/)
    color?: string;

    @IsOptional()
    @IsString()
    icon?: string;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    visibleOnWeb?: boolean;

    @IsOptional()
    @IsString()
    webName?: string;

    @IsOptional()
    @IsString()
    webDescription?: string;

    @IsOptional()
    @IsBoolean()
    displayPrice?: boolean;

    @IsOptional()
    @IsBoolean()
    forceOnlinePayment?: boolean;

    @IsOptional()
    @IsBoolean()
    forceOnlineRepayment?: boolean;

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    categoryIds?: string[];
}

export class ReorderPrestationsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReorderItemDto)
    prestations: ReorderItemDto[];
}

class ReorderItemDto {
    @IsUUID()
    id: string;

    @IsInt()
    @Min(0)
    sortOrder: number;
}
