import { IsString, IsOptional, IsNumber, IsBoolean, IsInt, IsEnum, Min, Max, MinLength, MaxLength, Matches, IsUUID } from 'class-validator';
import { VehicleClass } from '@prisma/client';

export class CreateCategoryDto {
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsEnum(VehicleClass)
    vehicleClass: VehicleClass;

    @IsOptional()
    @IsUUID()
    parentId?: string;

    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'اللون يجب أن يكون بصيغة HEX صالحة' })
    color: string;

    @IsOptional()
    @IsString()
    icon?: string;

    @IsOptional()
    @IsInt()
    @Min(15)
    @Max(480)
    duration?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateCategoryDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsEnum(VehicleClass)
    vehicleClass?: VehicleClass;

    @IsOptional()
    @IsUUID()
    parentId?: string;

    @IsOptional()
    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/)
    color?: string;

    @IsOptional()
    @IsString()
    icon?: string;

    @IsOptional()
    @IsInt()
    @Min(15)
    @Max(480)
    duration?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class ReorderCategoriesDto {
    categories: { id: string; sortOrder: number }[];
}
