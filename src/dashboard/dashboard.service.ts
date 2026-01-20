import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, PaymentStatus, InspectionResult } from '@prisma/client';

@Injectable()
export class DashboardService {
    constructor(private prisma: PrismaService) { }

    async getOverview(ctCenterId: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Current month stats
        const [
            reservationsThisMonth,
            reservationsLastMonth,
            revenueThisMonth,
            revenueLastMonth,
            totalClients,
            totalEmployees,
            todayReservations,
        ] = await Promise.all([
            this.prisma.reservation.count({
                where: { ctCenterId, createdAt: { gte: startOfMonth }, deletedAt: null },
            }),
            this.prisma.reservation.count({
                where: { ctCenterId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, deletedAt: null },
            }),
            this.prisma.payment.aggregate({
                where: { ctCenterId, paidAt: { gte: startOfMonth }, status: PaymentStatus.PAID },
                _sum: { amount: true },
            }),
            this.prisma.payment.aggregate({
                where: { ctCenterId, paidAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: PaymentStatus.PAID },
                _sum: { amount: true },
            }),
            this.prisma.client.count({ where: { ctCenterId, deletedAt: null } }),
            this.prisma.user.count({ where: { ctCenterId, deletedAt: null } }),
            this.prisma.reservation.count({
                where: {
                    ctCenterId,
                    date: { gte: new Date(now.setHours(0, 0, 0, 0)), lte: new Date(now.setHours(23, 59, 59, 999)) },
                    deletedAt: null,
                },
            }),
        ]);

        const currentRevenue = Number(revenueThisMonth._sum.amount || 0);
        const lastRevenue = Number(revenueLastMonth._sum.amount || 0);

        return {
            reservations: {
                current: reservationsThisMonth,
                change: this.calculateChange(reservationsLastMonth, reservationsThisMonth),
            },
            revenue: {
                current: currentRevenue,
                change: this.calculateChange(lastRevenue, currentRevenue),
            },
            clients: { total: totalClients },
            employees: { total: totalEmployees },
            today: { reservations: todayReservations },
        };
    }

    async getReservationChart(ctCenterId: string, days = 7) {
        const data: { date: string; day: string; count: number }[] = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const count = await this.prisma.reservation.count({
                where: {
                    ctCenterId,
                    date: { gte: date, lt: nextDate },
                    deletedAt: null,
                },
            });

            data.push({
                date: date.toISOString().split('T')[0],
                day: date.toLocaleDateString('ar-SA', { weekday: 'short' }),
                count,
            });
        }

        return data;
    }

    async getReservationStats(ctCenterId: string) {
        const statuses = await this.prisma.reservation.groupBy({
            by: ['status'],
            where: { ctCenterId, deletedAt: null },
            _count: true,
        });

        const results = await this.prisma.reservation.groupBy({
            by: ['result'],
            where: { ctCenterId, result: { not: null }, deletedAt: null },
            _count: true,
        });

        return {
            byStatus: statuses.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
            byResult: results.reduce((acc, r) => ({ ...acc, [r.result as string]: r._count }), {}),
            passRate: this.calculatePassRate(results),
        };
    }

    async getRevenueChart(ctCenterId: string, months = 6) {
        const data: { month: string; year: number; revenue: number }[] = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

            const revenue = await this.prisma.payment.aggregate({
                where: {
                    ctCenterId,
                    paidAt: { gte: startOfMonth, lte: endOfMonth },
                    status: PaymentStatus.PAID,
                },
                _sum: { amount: true },
            });

            data.push({
                month: startOfMonth.toLocaleDateString('ar-SA', { month: 'short' }),
                year: startOfMonth.getFullYear(),
                revenue: Number(revenue._sum.amount || 0),
            });
        }

        return data;
    }

    async getUpcomingReservations(ctCenterId: string, limit = 5) {
        const now = new Date();

        return this.prisma.reservation.findMany({
            where: {
                ctCenterId,
                date: { gte: now },
                status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
                deletedAt: null,
            },
            include: {
                client: { select: { firstName: true, lastName: true } },
                vehicle: { select: { plateNumber: true, brand: true, model: true } },
                category: { select: { name: true, color: true } },
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            take: limit,
        });
    }

    private calculateChange(previous: number, current: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    }

    private calculatePassRate(results: { result: InspectionResult | null; _count: number }[]): number {
        const passed = results.find(r => r.result === InspectionResult.PASSED)?._count || 0;
        const total = results.reduce((sum, r) => sum + r._count, 0);
        return total > 0 ? Math.round((passed / total) * 100) : 0;
    }
}
