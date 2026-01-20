import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { VehicleType, FuelType } from '@prisma/client';

export class CreateVehicleDto {
    @IsString()
    clientId: string;

    @IsString()
    plateNumber: string;

    @IsString()
    brand: string;

    @IsString()
    model: string;

    @IsOptional()
    @IsInt()
    @Min(1900)
    year?: number;

    @IsOptional()
    @IsString()
    vin?: string;

    @IsOptional()
    @IsEnum(VehicleType)
    type?: VehicleType;

    @IsOptional()
    @IsEnum(FuelType)
    fuelType?: FuelType;

    @IsOptional()
    @IsInt()
    @Min(0)
    mileage?: number;

    @IsOptional()
    @IsString()
    color?: string;
}

export class UpdateVehicleDto {
    @IsOptional()
    @IsString()
    brand?: string;

    @IsOptional()
    @IsString()
    model?: string;

    @IsOptional()
    @IsInt()
    @Min(1900)
    year?: number;

    @IsOptional()
    @IsString()
    vin?: string;

    @IsOptional()
    @IsEnum(VehicleType)
    type?: VehicleType;

    @IsOptional()
    @IsEnum(FuelType)
    fuelType?: FuelType;

    @IsOptional()
    @IsInt()
    @Min(0)
    mileage?: number;

    @IsOptional()
    @IsString()
    color?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
