import { IsString, IsOptional, IsEnum, IsDateString, IsUUID, IsInt, Min, Max, Matches } from 'class-validator';
import { ReservationStatus, InspectionResult } from '@prisma/client';

export class CreateReservationDto {
    @IsUUID()
    clientId: string;

    @IsUUID()
    vehicleId: string;

    @IsUUID()
    categoryId: string;

    @IsOptional()
    @IsUUID()
    employeeId?: string;

    @IsDateString()
    date: string;

    @IsString()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'الوقت يجب أن يكون بصيغة HH:mm' })
    startTime: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateReservationDto {
    @IsOptional()
    @IsDateString()
    date?: string;

    @IsOptional()
    @IsString()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    startTime?: string;

    @IsOptional()
    @IsUUID()
    employeeId?: string;

    @IsOptional()
    @IsEnum(ReservationStatus)
    status?: ReservationStatus;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateResultDto {
    @IsEnum(InspectionResult)
    result: InspectionResult;

    @IsOptional()
    report?: {
        defects?: string[];
        recommendations?: string[];
        observations?: string;
        validUntil?: string;
        mileage?: number;
    };

    @IsOptional()
    @IsString()
    notes?: string;
}

export class ReservationFilterDto {
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @IsOptional()
    @IsDateString()
    dateTo?: string;

    @IsOptional()
    @IsEnum(ReservationStatus)
    status?: ReservationStatus;

    @IsOptional()
    @IsEnum(InspectionResult)
    result?: InspectionResult;

    @IsOptional()
    @IsUUID()
    clientId?: string;

    @IsOptional()
    @IsUUID()
    employeeId?: string;

    @IsOptional()
    @IsUUID()
    categoryId?: string;

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

export class QuickReservationDto {
    // Client info
    @IsString()
    clientFirstName: string;

    @IsString()
    clientLastName: string;

    @IsString()
    clientPhone: string;

    @IsOptional()
    @IsString()
    clientEmail?: string;

    // Vehicle info
    @IsString()
    vehiclePlate: string;

    @IsString()
    vehicleBrand: string;

    @IsString()
    vehicleModel: string;

    // Reservation info
    @IsUUID()
    categoryId: string;

    @IsDateString()
    date: string;

    @IsString()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    startTime: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
