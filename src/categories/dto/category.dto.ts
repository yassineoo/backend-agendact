import { IsString, IsOptional, IsNumber, IsBoolean, IsInt, Min, Max, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'اللون يجب أن يكون بصيغة HEX صالحة' })
    color: string;

    @IsOptional()
    @IsString()
    icon?: string;

    @IsInt()
    @Min(15)
    @Max(480)
    duration: number;

    @IsNumber()
    @Min(0)
    price: number;

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
