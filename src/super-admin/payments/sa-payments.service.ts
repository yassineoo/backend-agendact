import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class SuperAdminPaymentsService {
    constructor(private prisma: PrismaService) { }

    async findAll(params?: { page?: number; limit?: number; status?: string; period?: string }) {
        const page = params?.page || 1;
        const limit = params?.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (params?.status && params.status !== 'all') {
            where.status = params.status.toUpperCase();
        }

        // Period filter
        if (params?.period) {
            const now = new Date();
            if (params.period === 'today') {
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                where.createdAt = { gte: startOfDay };
            } else if (params.period === 'weekly') {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                where.createdAt = { gte: startOfWeek };
            } else if (params.period === 'monthly') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                where.createdAt = { gte: startOfMonth };
            }
        }

        const [items, total] = await Promise.all([
            this.prisma.payment.findMany({
                where,
                skip,
                take: limit,
                include: {
                    ctCenter: { select: { id: true, name: true } },
                    reservation: {
                        select: {
                            id: true,
                            client: { select: { firstName: true, lastName: true, email: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.payment.count({ where }),
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
        const [paid, pending, failed] = await Promise.all([
            this.prisma.payment.count({ where: { status: PaymentStatus.PAID } }),
            this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
            this.prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
        ]);

        return {
            byStatus: {
                COMPLETED: paid,
                PENDING: pending,
                FAILED: failed,
            },
            total: paid + pending + failed,
        };
    }
}
