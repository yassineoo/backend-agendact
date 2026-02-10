import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class SuperAdminUsersService {
    constructor(private prisma: PrismaService) { }

    async findAll(params?: { page?: number; limit?: number; role?: string; search?: string; ctCenterId?: string }) {
        const page = params?.page || 1;
        const limit = params?.limit || 20;

        const where: any = {};
        if (params?.role) where.role = params.role;
        if (params?.ctCenterId) where.ctCenterId = params.ctCenterId;
        if (params?.search) {
            where.OR = [
                { firstName: { contains: params.search, mode: 'insensitive' } },
                { lastName: { contains: params.search, mode: 'insensitive' } },
                { email: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    ctCenterId: true,
                    ctCenter: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);

        return { data: users, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                ctCenterId: true,
                ctCenter: { select: { id: true, name: true, slug: true } },
            },
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async toggleActive(id: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');
        return this.prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive },
            select: { id: true, isActive: true },
        });
    }

    async updateRole(id: string, role: UserRole) {
        await this.findById(id);
        return this.prisma.user.update({
            where: { id },
            data: { role },
            select: { id: true, role: true },
        });
    }

    async delete(id: string) {
        await this.findById(id);
        return this.prisma.user.delete({ where: { id } });
    }
}
