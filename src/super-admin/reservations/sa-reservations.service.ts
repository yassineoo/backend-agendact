import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationStatus } from '@prisma/client';

@Injectable()
export class SuperAdminReservationsService {
    constructor(private prisma: PrismaService) { }

    async findAll(params?: { page?: number; limit?: number; status?: string }) {
        const page = params?.page || 1;
        const limit = params?.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = { deletedAt: null };
        if (params?.status && params.status !== 'all') {
            where.status = params.status.toUpperCase();
        }

        const [items, total] = await Promise.all([
            this.prisma.reservation.findMany({
                where,
                skip,
                take: limit,
                include: {
                    ctCenter: { select: { id: true, name: true, city: true, address: true } },
                    client: { select: { firstName: true, lastName: true, email: true } },
                    category: { select: { name: true } },
                    vehicle: { select: { plateNumber: true, brand: true, model: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.reservation.count({ where }),
        ]);

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getStats() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [pending, completed, cancelled] = await Promise.all([
            this.prisma.reservation.count({
                where: { status: ReservationStatus.PENDING, createdAt: { gte: startOfMonth }, deletedAt: null },
            }),
            this.prisma.reservation.count({
                where: { status: ReservationStatus.COMPLETED, createdAt: { gte: startOfMonth }, deletedAt: null },
            }),
            this.prisma.reservation.count({
                where: { status: ReservationStatus.CANCELLED, createdAt: { gte: startOfMonth }, deletedAt: null },
            }),
        ]);

        return {
            byStatus: { PENDING: pending, COMPLETED: completed, CANCELLED: cancelled },
            total: pending + completed + cancelled,
        };
    }
}
