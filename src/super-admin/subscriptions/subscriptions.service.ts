import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminSubscriptionsService {
    constructor(private prisma: PrismaService) { }

    async findAll(params?: { status?: string; page?: number; limit?: number }) {
        const page = params?.page || 1;
        const limit = params?.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (params?.status && params.status !== 'all') {
            where.status = params.status.toUpperCase();
        }

        const [items, total] = await Promise.all([
            this.prisma.subscription.findMany({
                where,
                skip,
                take: limit,
                include: {
                    ctCenter: { select: { id: true, name: true, email: true } },
                    plan: { select: { id: true, name: true, price: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.subscription.count({ where }),
        ]);

        return {
            items: items.map((sub) => ({
                id: `#${sub.id.slice(0, 6).toUpperCase()}`,
                email: sub.ctCenter.email,
                customer: sub.ctCenter.name,
                center: sub.ctCenter.name,
                plan: sub.plan.name,
                gateway: sub.paymentMethod || '-------',
                renewsAt: sub.endDate?.toLocaleDateString('fr-FR') || '-',
                endsAt: sub.endDate?.toLocaleDateString('fr-FR') || '-',
                status: sub.status.toLowerCase(),
                verified: sub.status === 'ACTIVE',
                rawId: sub.id,
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findOne(id: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { id },
            include: {
                ctCenter: true,
                plan: true,
            },
        });
        if (!subscription) throw new NotFoundException('Subscription not found');
        return subscription;
    }

    async create(dto: any) {
        return this.prisma.subscription.create({
            data: {
                ctCenterId: dto.centerId,
                planId: dto.planId,
                status: 'ACTIVE',
                startDate: new Date(),
                endDate: dto.endDate ? new Date(dto.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                amount: dto.amount || 0,
                paymentMethod: dto.gateway || null,
                autoRenew: dto.autoRenew || false,
            },
        });
    }

    async update(id: string, dto: any) {
        const data: any = {};
        if (dto.planId) data.planId = dto.planId;
        if (dto.status) data.status = dto.status.toUpperCase();
        if (dto.endDate) data.endDate = new Date(dto.endDate);
        if (dto.gateway) data.paymentMethod = dto.gateway;
        if (typeof dto.autoRenew === 'boolean') data.autoRenew = dto.autoRenew;

        return this.prisma.subscription.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        return this.prisma.subscription.delete({ where: { id } });
    }

    async getStats() {
        const [total, active, pending, cancelled] = await Promise.all([
            this.prisma.subscription.count(),
            this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
            this.prisma.subscription.count({ where: { status: 'PENDING' } }),
            this.prisma.subscription.count({ where: { status: 'CANCELLED' } }),
        ]);

        return { total, active, pending, cancelled };
    }
}
