import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, SubscriptionStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class SuperAdminCentersService {
    constructor(private prisma: PrismaService) { }

    async findAll(filter: {
        status?: 'active' | 'inactive' | 'all';
        search?: string;
        city?: string;
        page?: number;
        limit?: number;
    }) {
        const where: Prisma.CTCenterWhereInput = {
            deletedAt: null,
        };

        if (filter.status === 'active') where.isActive = true;
        if (filter.status === 'inactive') where.isActive = false;
        if (filter.city) where.city = filter.city;

        if (filter.search) {
            where.OR = [
                { name: { contains: filter.search, mode: 'insensitive' } },
                { email: { contains: filter.search, mode: 'insensitive' } },
                { phone: { contains: filter.search } },
            ];
        }

        const [total, items] = await Promise.all([
            this.prisma.cTCenter.count({ where }),
            this.prisma.cTCenter.findMany({
                where,
                include: {
                    owner: { select: { id: true, firstName: true, lastName: true, email: true } },
                    subscriptions: {
                        where: { status: SubscriptionStatus.ACTIVE },
                        take: 1,
                        orderBy: { endDate: 'desc' },
                        include: { plan: true },
                    },
                    _count: { select: { users: true, clients: true, reservations: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: ((filter.page || 1) - 1) * (filter.limit || 20),
                take: filter.limit || 20,
            }),
        ]);

        return {
            items: items.map((center) => ({
                ...center,
                subscription: center.subscriptions[0] || null,
                employeesCount: center._count.users,
                clientsCount: center._count.clients,
                reservationsCount: center._count.reservations,
            })),
            total,
            page: filter.page || 1,
            limit: filter.limit || 20,
            totalPages: Math.ceil(total / (filter.limit || 20)),
        };
    }

    async findOne(id: string) {
        const center = await this.prisma.cTCenter.findFirst({
            where: { id, deletedAt: null },
            include: {
                owner: true,
                users: { where: { deletedAt: null } },
                subscriptions: {
                    orderBy: { createdAt: 'desc' },
                    include: { plan: true },
                },
                _count: { select: { clients: true, vehicles: true, reservations: true } },
            },
        });

        if (!center) {
            throw new NotFoundException('المركز غير موجود');
        }

        return center;
    }

    async create(dto: {
        name: string;
        address: string;
        city: string;
        postalCode: string;
        phone: string;
        email: string;
        adminFirstName: string;
        adminLastName: string;
        adminEmail: string;
        adminPhone: string;
        subscriptionPlanId: string;
    }) {
        // Generate unique slug
        const baseSlug = dto.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        let slug = baseSlug;
        let count = 1;
        while (await this.prisma.cTCenter.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${count++}`;
        }

        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const result = await this.prisma.$transaction(async (tx) => {
            // Create admin user
            const admin = await tx.user.create({
                data: {
                    email: dto.adminEmail,
                    password: hashedPassword,
                    firstName: dto.adminFirstName,
                    lastName: dto.adminLastName,
                    phone: dto.adminPhone,
                    role: UserRole.CT_ADMIN,
                    isActive: true,
                    emailVerified: true,
                },
            });

            // Create center
            const center = await tx.cTCenter.create({
                data: {
                    name: dto.name,
                    slug,
                    address: dto.address,
                    city: dto.city,
                    postalCode: dto.postalCode,
                    phone: dto.phone,
                    email: dto.email,
                    ownerId: admin.id,
                    isActive: true,
                    openingHours: {
                        monday: { open: '08:00', close: '18:00', closed: false },
                        tuesday: { open: '08:00', close: '18:00', closed: false },
                        wednesday: { open: '08:00', close: '18:00', closed: false },
                        thursday: { open: '08:00', close: '18:00', closed: false },
                        friday: { open: '08:00', close: '18:00', closed: false },
                        saturday: { open: '09:00', close: '13:00', closed: false },
                        sunday: { open: '00:00', close: '00:00', closed: true },
                    },
                },
            });

            // Link admin to center
            await tx.user.update({
                where: { id: admin.id },
                data: { ctCenterId: center.id },
            });

            // Create subscription
            const plan = await tx.subscriptionPlan.findUnique({
                where: { id: dto.subscriptionPlanId },
            });

            if (plan) {
                await tx.subscription.create({
                    data: {
                        ctCenterId: center.id,
                        planId: plan.id,
                        status: SubscriptionStatus.ACTIVE,
                        startDate: new Date(),
                        endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000),
                        amount: plan.price,
                    },
                });
            }

            return { center, admin, tempPassword };
        });

        return {
            center: result.center,
            adminCredentials: {
                email: result.admin.email,
                temporaryPassword: result.tempPassword,
            },
        };
    }

    async toggleActive(id: string) {
        const center = await this.findOne(id);

        return this.prisma.cTCenter.update({
            where: { id },
            data: { isActive: !center.isActive },
        });
    }

    async remove(id: string) {
        await this.findOne(id);

        await this.prisma.cTCenter.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
    }

    async getStats() {
        const [total, active, inactive] = await Promise.all([
            this.prisma.cTCenter.count({ where: { deletedAt: null } }),
            this.prisma.cTCenter.count({ where: { isActive: true, deletedAt: null } }),
            this.prisma.cTCenter.count({ where: { isActive: false, deletedAt: null } }),
        ]);

        const byCity = await this.prisma.cTCenter.groupBy({
            by: ['city'],
            where: { deletedAt: null },
            _count: true,
            orderBy: { _count: { city: 'desc' } },
            take: 10,
        });

        return {
            total,
            active,
            inactive,
            byCity: byCity.map((c) => ({ city: c.city, count: c._count })),
        };
    }
}
