import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, ClientType, VehicleType, DiscountType } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PublicBookingService {
    constructor(private prisma: PrismaService) { }

    /** Resolve slug → ctCenterId, throw 404 if not found */
    private async resolveCenterId(slug: string): Promise<string> {
        const center = await this.prisma.cTCenter.findFirst({
            where: { slug, deletedAt: null },
            select: { id: true },
        });
        if (!center) {
            throw new NotFoundException('Center not found');
        }
        return center.id;
    }

    /** Get active categories for a center */
    async getCategories(slug: string) {
        const ctCenterId = await this.resolveCenterId(slug);
        return this.prisma.category.findMany({
            where: { ctCenterId, isActive: true, deletedAt: null },
            select: {
                id: true,
                name: true,
                description: true,
                duration: true,
                price: true,
                color: true,
            },
            orderBy: { sortOrder: 'asc' },
        });
    }

    /** Get available slots for a given date (and optionally category) */
    async getSlots(slug: string, date: string, categoryId?: string) {
        const ctCenterId = await this.resolveCenterId(slug);

        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
        }

        // Get center opening hours
        const center = await this.prisma.cTCenter.findUnique({
            where: { id: ctCenterId },
        });

        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][parsedDate.getDay()];
        const openingHours = center?.openingHours as any;
        const todayHours = openingHours?.[dayOfWeek];

        if (!todayHours || todayHours.closed || !todayHours.open || !todayHours.close) {
            return { date, closed: true, slots: [] };
        }

        // Check holidays
        const startOfDay = new Date(parsedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const holiday = await this.prisma.holiday.findFirst({
            where: { ctCenterId, date: startOfDay, isActive: true },
        });
        if (holiday) {
            return { date, closed: true, holiday: holiday.name, slots: [] };
        }

        // Get existing reservations
        const endOfDay = new Date(parsedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const reservations = await this.prisma.reservation.findMany({
            where: {
                ctCenterId,
                date: { gte: startOfDay, lte: endOfDay },
                status: { notIn: [ReservationStatus.CANCELLED] },
                deletedAt: null,
            },
        });

        // Get category info for slot duration
        let slotDuration = 30;
        if (categoryId) {
            const category = await this.prisma.category.findUnique({
                where: { id: categoryId },
                select: { duration: true },
            });
            if (category?.duration) slotDuration = category.duration;
        }

        const [openHour, openMin] = todayHours.open.split(':').map(Number);
        const [closeHour, closeMin] = todayHours.close.split(':').map(Number);

        const slots: { startTime: string; endTime: string; isAvailable: boolean }[] = [];
        const current = new Date(parsedDate);
        current.setHours(openHour, openMin, 0, 0);
        const close = new Date(parsedDate);
        close.setHours(closeHour, closeMin, 0, 0);

        while (current < close) {
            const slotStart = new Date(current);
            const slotEnd = new Date(current);
            slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

            if (slotEnd > close) break;

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

            current.setMinutes(current.getMinutes() + slotDuration);
        }

        return { date, closed: false, slots };
    }

    /** Get active promotions for a center */
    async getPromotions(slug: string) {
        const ctCenterId = await this.resolveCenterId(slug);
        return this.prisma.promotion.findMany({
            where: {
                ctCenterId,
                isActive: true,
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
            },
            select: {
                id: true,
                name: true,
                code: true,
                discountType: true,
                discountValue: true,
            },
        });
    }

    /** Create a public booking */
    async book(slug: string, dto: {
        clientFirstName: string;
        clientLastName: string;
        clientPhone: string;
        clientEmail?: string;
        vehicleBrand: string;
        vehicleModel: string;
        vehiclePlate: string;
        categoryId: string;
        date: string;
        startTime: string;
        notes?: string;
        promoCode?: string;
    }) {
        const ctCenterId = await this.resolveCenterId(slug);

        return this.prisma.$transaction(async (tx) => {
            // Find or create client
            let client = await tx.client.findFirst({
                where: {
                    ctCenterId,
                    OR: [
                        { phone: dto.clientPhone },
                        ...(dto.clientEmail ? [{ email: dto.clientEmail }] : []),
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
                        email: dto.clientEmail || `${dto.clientPhone}@booking.agendact.com`,
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

            // Validate category
            const category = await tx.category.findUnique({
                where: { id: dto.categoryId },
            });
            if (!category) {
                throw new BadRequestException('Invalid category');
            }

            // Parse date/time
            const date = new Date(dto.date);
            const [hours, minutes] = dto.startTime.split(':').map(Number);
            const startTime = new Date(date);
            startTime.setHours(hours, minutes, 0, 0);
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + (category.duration || 30));

            // Check availability
            const conflict = await tx.reservation.findFirst({
                where: {
                    ctCenterId,
                    date,
                    status: { notIn: [ReservationStatus.CANCELLED] },
                    OR: [{ startTime: { lt: endTime }, endTime: { gt: startTime } }],
                    deletedAt: null,
                },
            });

            if (conflict) {
                throw new BadRequestException('This time slot is no longer available. Please choose another.');
            }

            // Generate booking code
            const bookingCode = 'WEB-' + crypto.randomBytes(4).toString('hex').toUpperCase();

            // Apply promo
            let price = Number(category.price) || 0;
            if (dto.promoCode) {
                const promo = await tx.promotion.findFirst({
                    where: {
                        ctCenterId,
                        code: dto.promoCode,
                        isActive: true,
                        startDate: { lte: new Date() },
                        endDate: { gte: new Date() },
                    },
                });
                if (promo) {
                    const discountVal = Number(promo.discountValue) || 0;
                    if (promo.discountType === DiscountType.PERCENTAGE) {
                        price = price * (1 - discountVal / 100);
                    } else if (promo.discountType === DiscountType.FIXED_AMOUNT) {
                        price = Math.max(0, price - discountVal);
                    }
                }
            }

            const reservation = await tx.reservation.create({
                data: {
                    ctCenterId,
                    clientId: client.id,
                    vehicleId: vehicle.id,
                    categoryId: dto.categoryId,
                    date,
                    startTime,
                    endTime,
                    status: ReservationStatus.CONFIRMED,
                    source: 'WEB',
                    notes: dto.notes,
                    bookingCode,
                    price,
                },
                include: {
                    category: { select: { name: true, price: true } },
                },
            });

            return {
                bookingCode: reservation.bookingCode,
                date: dto.date,
                startTime: dto.startTime,
                endTime: `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`,
                category: reservation.category?.name,
                vehicle: `${dto.vehicleBrand} ${dto.vehicleModel} (${dto.vehiclePlate})`,
                clientName: `${dto.clientFirstName} ${dto.clientLastName}`,
                price,
            };
        });
    }
}
