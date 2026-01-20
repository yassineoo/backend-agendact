import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto, UpdateHolidayDto, HolidayFilterDto } from './dto';

@Injectable()
export class HolidaysService {
    constructor(private prisma: PrismaService) { }

    async findAll(ctCenterId: string, filter: HolidayFilterDto) {
        const where: any = {
            ctCenterId,
        };

        if (!filter.includeInactive) {
            where.isActive = true;
        }

        if (filter.year) {
            const startOfYear = new Date(filter.year, 0, 1);
            const endOfYear = new Date(filter.year, 11, 31);
            where.date = { gte: startOfYear, lte: endOfYear };
        }

        if (filter.month && filter.year) {
            const startOfMonth = new Date(filter.year, filter.month - 1, 1);
            const endOfMonth = new Date(filter.year, filter.month, 0);
            where.date = { gte: startOfMonth, lte: endOfMonth };
        }

        return this.prisma.holiday.findMany({
            where,
            orderBy: { date: 'asc' },
        });
    }

    async findOne(ctCenterId: string, id: string) {
        const holiday = await this.prisma.holiday.findFirst({
            where: { id, ctCenterId },
        });

        if (!holiday) {
            throw new NotFoundException('العطلة غير موجودة');
        }

        return holiday;
    }

    async create(ctCenterId: string, dto: CreateHolidayDto) {
        return this.prisma.holiday.create({
            data: {
                ...dto,
                ctCenterId,
                date: new Date(dto.date),
                isActive: true,
            },
        });
    }

    async update(ctCenterId: string, id: string, dto: UpdateHolidayDto) {
        await this.findOne(ctCenterId, id);

        return this.prisma.holiday.update({
            where: { id },
            data: {
                ...dto,
                date: dto.date ? new Date(dto.date) : undefined,
            },
        });
    }

    async remove(ctCenterId: string, id: string) {
        await this.findOne(ctCenterId, id);

        // Hard delete since no deletedAt field
        await this.prisma.holiday.delete({
            where: { id },
        });
    }

    async toggleActive(ctCenterId: string, id: string) {
        const holiday = await this.findOne(ctCenterId, id);

        return this.prisma.holiday.update({
            where: { id },
            data: { isActive: !holiday.isActive },
        });
    }

    async getUpcoming(ctCenterId: string, limit = 5) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return this.prisma.holiday.findMany({
            where: {
                ctCenterId,
                date: { gte: today },
                isActive: true,
            },
            orderBy: { date: 'asc' },
            take: limit,
        });
    }

    // Import French public holidays
    async importPublicHolidays(ctCenterId: string, year: number) {
        const frenchHolidays = [
            { name: 'Jour de l\'An', month: 0, day: 1 },
            { name: 'Lundi de Pâques', month: 3, day: 10 },
            { name: 'Fête du Travail', month: 4, day: 1 },
            { name: 'Victoire 1945', month: 4, day: 8 },
            { name: 'Ascension', month: 4, day: 18 },
            { name: 'Lundi de Pentecôte', month: 4, day: 29 },
            { name: 'Fête Nationale', month: 6, day: 14 },
            { name: 'Assomption', month: 7, day: 15 },
            { name: 'Toussaint', month: 10, day: 1 },
            { name: 'Armistice', month: 10, day: 11 },
            { name: 'Noël', month: 11, day: 25 },
        ];

        const created: any[] = [];

        for (const holiday of frenchHolidays) {
            const date = new Date(year, holiday.month, holiday.day);

            // Check if already exists
            const existing = await this.prisma.holiday.findFirst({
                where: {
                    ctCenterId,
                    date,
                },
            });

            if (!existing) {
                const newHoliday = await this.prisma.holiday.create({
                    data: {
                        ctCenterId,
                        name: holiday.name,
                        date,
                        isRecurring: true,
                        isActive: true,
                    },
                });
                created.push(newHoliday);
            }
        }

        return created;
    }
}
