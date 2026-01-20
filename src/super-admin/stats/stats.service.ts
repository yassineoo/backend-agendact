import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class SuperAdminStatsService {
    constructor(private prisma: PrismaService) { }

    async getOverview() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const [
            totalCenters,
            activeCenters,
            activeSubscriptions,
            totalClients,
            totalVehicles,
            revenueThisMonth,
            revenueLastMonth,
        ] = await Promise.all([
            this.prisma.cTCenter.count({ where: { deletedAt: null } }),
            this.prisma.cTCenter.count({ where: { isActive: true, deletedAt: null } }),
            this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
            this.prisma.client.count({ where: { deletedAt: null } }),
            this.prisma.vehicle.count({ where: { deletedAt: null } }),
            this.prisma.payment.aggregate({
                where: { paidAt: { gte: startOfMonth }, status: PaymentStatus.PAID },
                _sum: { amount: true },
            }),
            this.prisma.payment.aggregate({
                where: { paidAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: PaymentStatus.PAID },
                _sum: { amount: true },
            }),
        ]);

        return {
            centers: { total: totalCenters, active: activeCenters, inactive: totalCenters - activeCenters },
            subscriptions: { active: activeSubscriptions },
            clients: { total: totalClients },
            vehicles: { total: totalVehicles },
            revenue: {
                current: Number(revenueThisMonth._sum.amount || 0),
                change: this.calculateChange(
                    Number(revenueLastMonth._sum.amount || 0),
                    Number(revenueThisMonth._sum.amount || 0),
                ),
            },
        };
    }

    async getReservationsChart(months = 6) {
        const data: { month: string; count: number }[] = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

            const count = await this.prisma.reservation.count({
                where: { createdAt: { gte: startOfMonth, lte: endOfMonth }, deletedAt: null },
            });

            data.push({
                month: startOfMonth.toLocaleDateString('ar-SA', { month: 'short' }),
                count,
            });
        }

        return data;
    }

    async getTopCenters(limit = 10, metric: 'reservations' | 'revenue' = 'reservations') {
        if (metric === 'reservations') {
            const centers = await this.prisma.cTCenter.findMany({
                where: { deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    city: true,
                    _count: { select: { reservations: true } },
                },
                orderBy: { reservations: { _count: 'desc' } },
                take: limit,
            });

            return centers.map((c) => ({ ...c, value: c._count.reservations }));
        }

        // Revenue ranking
        const payments = await this.prisma.payment.groupBy({
            by: ['ctCenterId'],
            where: { status: PaymentStatus.PAID },
            _sum: { amount: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: limit,
        });

        const centerIds = payments.map((p) => p.ctCenterId);
        const centers = await this.prisma.cTCenter.findMany({
            where: { id: { in: centerIds } },
            select: { id: true, name: true, city: true },
        });

        return payments.map((p) => {
            const center = centers.find((c) => c.id === p.ctCenterId);
            return {
                id: p.ctCenterId,
                name: center?.name || 'Unknown',
                city: center?.city,
                value: Number(p._sum.amount || 0),
            };
        });
    }

    private calculateChange(previous: number, current: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    }
}
