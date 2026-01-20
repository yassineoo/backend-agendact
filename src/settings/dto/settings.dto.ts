import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class UpdateSettingDto {
    @IsOptional()
    @IsString()
    value?: string;

    @IsOptional()
    @IsObject()
    jsonValue?: Record<string, any>;
}

export class UpdateCTCenterSettingsDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    postalCode?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    logo?: string;

    @IsOptional()
    @IsObject()
    openingHours?: Record<string, any>;

    @IsOptional()
    @IsString()
    timezone?: string;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsObject()
    notificationSettings?: Record<string, any>;
}

export class UpdateOpeningHoursDto {
    monday?: { open: string; close: string; closed: boolean };
    tuesday?: { open: string; close: string; closed: boolean };
    wednesday?: { open: string; close: string; closed: boolean };
    thursday?: { open: string; close: string; closed: boolean };
    friday?: { open: string; close: string; closed: boolean };
    saturday?: { open: string; close: string; closed: boolean };
    sunday?: { open: string; close: string; closed: boolean };
}
