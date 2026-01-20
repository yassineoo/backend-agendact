import { IsString, IsOptional, IsDateString, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class CreateHolidayDto {
    @IsString()
    name: string;

    @IsDateString()
    date: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isRecurring?: boolean;
}

export class UpdateHolidayDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsDateString()
    date?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isRecurring?: boolean;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class HolidayFilterDto {
    @IsOptional()
    @IsInt()
    year?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @IsOptional()
    @IsBoolean()
    includeInactive?: boolean;
}
