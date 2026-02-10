import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminPlansService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.subscriptionPlan.findMany({
            orderBy: { sortOrder: 'asc' },
        });
    }

    async findById(id: string) {
        const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    async create(data: {
        name: string;
        description?: string;
        price: number;
        duration: number;
        features?: any;
        maxUsers: number;
        maxVehicles?: number;
        stripeProductId?: string;
        stripePriceId?: string;
    }) {
        const maxSort = await this.prisma.subscriptionPlan.aggregate({ _max: { sortOrder: true } });
        return this.prisma.subscriptionPlan.create({
            data: {
                ...data,
                sortOrder: (maxSort._max.sortOrder || 0) + 1,
            },
        });
    }

    async update(id: string, data: Partial<{
        name: string;
        description: string;
        price: number;
        duration: number;
        features: any;
        maxUsers: number;
        maxVehicles: number;
        isActive: boolean;
        stripeProductId: string;
        stripePriceId: string;
    }>) {
        await this.findById(id);
        return this.prisma.subscriptionPlan.update({ where: { id }, data });
    }

    async delete(id: string) {
        await this.findById(id);
        // Check if any active subscriptions use this plan
        const active = await this.prisma.subscription.count({
            where: { planId: id, status: 'ACTIVE' },
        });
        if (active > 0) {
            // Soft-delete: deactivate instead
            return this.prisma.subscriptionPlan.update({
                where: { id },
                data: { isActive: false },
            });
        }
        return this.prisma.subscriptionPlan.delete({ where: { id } });
    }
}
