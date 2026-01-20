import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto, UpdateReservationDto, UpdateResultDto, ReservationFilterDto, QuickReservationDto } from './dto';
import { Prisma, ReservationStatus, ClientType, VehicleType } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class ReservationsService {
    constructor(private prisma: PrismaService) { }

    async findAll(ctCenterId: string, filter: ReservationFilterDto) {
        const where: Prisma.ReservationWhereInput = {
            ctCenterId,
            deletedAt: null,
        };

        if (filter.dateFrom) {
            where.date = { ...where.date as any, gte: new Date(filter.dateFrom) };
        }
        if (filter.dateTo) {
            where.date = { ...where.date as any, lte: new Date(filter.dateTo) };
        }
        if (filter.status) where.status = filter.status;
        if (filter.result) where.result = filter.result;
        if (filter.clientId) where.clientId = filter.clientId;
        if (filter.employeeId) where.employeeId = filter.employeeId;
        if (filter.categoryId) where.categoryId = filter.categoryId;

        if (filter.search) {
            where.OR = [
                { client: { firstName: { contains: filter.search, mode: 'insensitive' } } },
                { client: { lastName: { contains: filter.search, mode: 'insensitive' } } },
                { vehicle: { plateNumber: { contains: filter.search, mode: 'insensitive' } } },
                { bookingCode: { contains: filter.search, mode: 'insensitive' } },
            ];
        }

        const [total, items] = await Promise.all([
            this.prisma.reservation.count({ where }),
            this.prisma.reservation.findMany({
                where,
                include: {
                    client: true,
                    vehicle: true,
                    category: true,
                    employee: { select: { id: true, firstName: true, lastName: true } },
                },
                orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
                skip: ((filter.page || 1) - 1) * (filter.limit || 20),
                take: filter.limit || 20,
            }),
        ]);

        return {
            items,
            total,
            page: filter.page || 1,
            limit: filter.limit || 20,
            totalPages: Math.ceil(total / (filter.limit || 20)),
        };
    }

    async findOne(ctCenterId: string, id: string) {
        const reservation = await this.prisma.reservation.findFirst({
            where: { id, ctCenterId, deletedAt: null },
            include: {
                client: true,
                vehicle: true,
                category: true,
                employee: { select: { id: true, firstName: true, lastName: true } },
                payments: true,
            },
        });

        if (!reservation) {
            throw new NotFoundException('الحجز غير موجود');
        }

        return reservation;
    }

    async getDaySchedule(ctCenterId: string, date: Date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const reservations = await this.prisma.reservation.findMany({
            where: {
                ctCenterId,
                date: { gte: startOfDay, lte: endOfDay },
                status: { notIn: [ReservationStatus.CANCELLED] },
                deletedAt: null,
            },
            include: {
                client: true,
                vehicle: true,
                category: true,
                employee: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { startTime: 'asc' },
        });

        // Check for holidays
        const holiday = await this.prisma.holiday.findFirst({
            where: {
                ctCenterId,
                date: startOfDay,
                isActive: true,
            },
        });

        return {
            date: date.toISOString().split('T')[0],
            isHoliday: !!holiday,
            holidayName: holiday?.name,
            reservations,
            stats: {
                total: reservations.length,
                confirmed: reservations.filter(r => r.status === ReservationStatus.CONFIRMED).length,
                completed: reservations.filter(r => r.status === ReservationStatus.COMPLETED).length,
            },
        };
    }

    async create(ctCenterId: string, dto: CreateReservationDto, userId: string) {
        // Get category duration
        const category = await this.prisma.category.findUnique({
            where: { id: dto.categoryId },
        });

        if (!category) {
            throw new BadRequestException('الفئة غير موجودة');
        }

        // Parse times
        const date = new Date(dto.date);
        const [hours, minutes] = dto.startTime.split(':').map(Number);
        const startTime = new Date(date);
        startTime.setHours(hours, minutes, 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + category.duration);

        // Check availability
        const conflicting = await this.prisma.reservation.findFirst({
            where: {
                ctCenterId,
                date,
                status: { notIn: [ReservationStatus.CANCELLED] },
                OR: [
                    { startTime: { lt: endTime }, endTime: { gt: startTime } },
                ],
                deletedAt: null,
            },
        });

        if (conflicting) {
            throw new ConflictException('الفترة الزمنية غير متاحة');
        }

        // Generate booking code
        const bookingCode = 'RES-' + crypto.randomBytes(4).toString('hex').toUpperCase();

        return this.prisma.reservation.create({
            data: {
                ctCenterId,
                clientId: dto.clientId,
                vehicleId: dto.vehicleId,
                categoryId: dto.categoryId,
                employeeId: dto.employeeId,
                date,
                startTime,
                endTime,
                status: ReservationStatus.CONFIRMED,
                notes: dto.notes,
                bookingCode,
            },
            include: {
                client: true,
                vehicle: true,
                category: true,
                employee: { select: { id: true, firstName: true, lastName: true } },
            },
        });
    }

    async quickReservation(ctCenterId: string, dto: QuickReservationDto, userId: string) {
        return this.prisma.$transaction(async (tx) => {
            // Find or create client
            let client = await tx.client.findFirst({
                where: {
                    ctCenterId,
                    OR: [
                        { phone: dto.clientPhone },
                        { email: dto.clientEmail },
                    ],
                    deletedAt: null,
                },
            });

            if (!client) {
                client = await tx.client.create({
                    data: {
                        ctCenterId,
                        firstName: dto.clientFirstName,
                        lastName: dto.clientLastName,
                        phone: dto.clientPhone,
                        email: dto.clientEmail || `${dto.clientPhone}@temp.agendact.com`,
                        type: ClientType.NORMAL,
                    },
                });
            }

            // Find or create vehicle
            let vehicle = await tx.vehicle.findFirst({
                where: {
                    ctCenterId,
                    plateNumber: dto.vehiclePlate,
                    deletedAt: null,
                },
            });

            if (!vehicle) {
                vehicle = await tx.vehicle.create({
                    data: {
                        ctCenterId,
                        clientId: client.id,
                        plateNumber: dto.vehiclePlate,
                        brand: dto.vehicleBrand,
                        model: dto.vehicleModel,
                        type: VehicleType.CAR,
                    },
                });
            }

            // Create reservation using the main create method logic
            const category = await tx.category.findUnique({
                where: { id: dto.categoryId },
            });

            if (!category) {
                throw new BadRequestException('الفئة غير موجودة');
            }

            const date = new Date(dto.date);
            const [hours, minutes] = dto.startTime.split(':').map(Number);
            const startTime = new Date(date);
            startTime.setHours(hours, minutes, 0, 0);

            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + category.duration);

            const bookingCode = 'RES-' + crypto.randomBytes(4).toString('hex').toUpperCase();

            return tx.reservation.create({
                data: {
                    ctCenterId,
                    clientId: client.id,
                    vehicleId: vehicle.id,
                    categoryId: dto.categoryId,
                    date,
                    startTime,
                    endTime,
                    status: ReservationStatus.CONFIRMED,
                    notes: dto.notes,
                    bookingCode,
                },
                include: {
                    client: true,
                    vehicle: true,
                    category: true,
                },
            });
        });
    }

    async update(ctCenterId: string, id: string, dto: UpdateReservationDto) {
        const reservation = await this.findOne(ctCenterId, id);

        const updateData: any = { ...dto };

        if (dto.date || dto.startTime) {
            const category = await this.prisma.category.findUnique({
                where: { id: reservation.categoryId },
            });

            const date = dto.date ? new Date(dto.date) : reservation.date;
            const startTimeStr = dto.startTime ||
                `${reservation.startTime.getHours().toString().padStart(2, '0')}:${reservation.startTime.getMinutes().toString().padStart(2, '0')}`;

            const [hours, minutes] = startTimeStr.split(':').map(Number);
            const startTime = new Date(date);
            startTime.setHours(hours, minutes, 0, 0);

            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + (category?.duration || 30));

            updateData.date = date;
            updateData.startTime = startTime;
            updateData.endTime = endTime;
            delete updateData.startTime;
        }

        return this.prisma.reservation.update({
            where: { id },
            data: updateData,
            include: {
                client: true,
                vehicle: true,
                category: true,
                employee: { select: { id: true, firstName: true, lastName: true } },
            },
        });
    }

    async updateResult(ctCenterId: string, id: string, dto: UpdateResultDto) {
        const reservation = await this.findOne(ctCenterId, id);

        // Update reservation
        const updated = await this.prisma.reservation.update({
            where: { id },
            data: {
                result: dto.result,
                report: dto.report as any,
                notes: dto.notes || reservation.notes,
                status: ReservationStatus.COMPLETED,
            },
        });

        // Update vehicle info
        await this.prisma.vehicle.update({
            where: { id: reservation.vehicleId },
            data: {
                lastInspectionDate: reservation.date,
                lastInspectionResult: dto.result,
                nextInspectionDue: dto.report?.validUntil ? new Date(dto.report.validUntil) : null,
                mileage: dto.report?.mileage,
            },
        });

        return updated;
    }

    async cancel(ctCenterId: string, id: string, reason?: string) {
        await this.findOne(ctCenterId, id);

        return this.prisma.reservation.update({
            where: { id },
            data: {
                status: ReservationStatus.CANCELLED,
                notes: reason ? `[إلغاء] ${reason}` : undefined,
            },
        });
    }

    async assignEmployee(ctCenterId: string, id: string, employeeId: string) {
        await this.findOne(ctCenterId, id);

        return this.prisma.reservation.update({
            where: { id },
            data: { employeeId },
            include: {
                employee: { select: { id: true, firstName: true, lastName: true } },
            },
        });
    }

    async getAvailableSlots(ctCenterId: string, date: Date, categoryId?: string) {
        // Get opening hours from settings
        const center = await this.prisma.cTCenter.findUnique({
            where: { id: ctCenterId },
        });

        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const openingHours = center?.openingHours as any;
        const todayHours = openingHours?.[dayOfWeek];

        if (!todayHours || todayHours.closed) {
            return [];
        }

        // Get existing reservations
        const reservations = await this.prisma.reservation.findMany({
            where: {
                ctCenterId,
                date,
                status: { notIn: [ReservationStatus.CANCELLED] },
                deletedAt: null,
            },
        });

        // Generate slots (30 min intervals)
        const slots: { startTime: string; endTime: string; isAvailable: boolean }[] = [];
        const [openHour, openMin] = todayHours.open.split(':').map(Number);
        const [closeHour, closeMin] = todayHours.close.split(':').map(Number);

        const current = new Date(date);
        current.setHours(openHour, openMin, 0, 0);

        const close = new Date(date);
        close.setHours(closeHour, closeMin, 0, 0);

        while (current < close) {
            const slotStart = new Date(current);
            const slotEnd = new Date(current);
            slotEnd.setMinutes(slotEnd.getMinutes() + 30);

            const isBooked = reservations.some(r => {
                const resStart = new Date(r.startTime);
                const resEnd = new Date(r.endTime);
                return slotStart < resEnd && slotEnd > resStart;
            });

            slots.push({
                startTime: `${current.getHours().toString().padStart(2, '0')}:${current.getMinutes().toString().padStart(2, '0')}`,
                endTime: `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`,
                isAvailable: !isBooked,
            });

            current.setMinutes(current.getMinutes() + 30);
        }

        return slots;
    }
}
