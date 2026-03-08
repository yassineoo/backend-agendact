import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

interface FindAllOptions {
    includeInactive?: boolean;
    role?: UserRole;
    search?: string;
    page?: number;
    limit?: number;
}

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll(ctCenterId: string, options: FindAllOptions = {}) {
        const { includeInactive = false, role, search, page = 1, limit = 20 } = options;

        const where: any = {
            ctCenterId,
            deletedAt: null,
            ...(includeInactive ? {} : { isActive: true }),
        };

        // Filter by role
        if (role) {
            where.role = role;
        }

        // Search by name or email
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    role: true,
                    isActive: true,
                    avatar: true,
                    lastLogin: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findOne(ctCenterId: string, id: string) {
        const user = await this.prisma.user.findFirst({
            where: { id, ctCenterId, deletedAt: null },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                avatar: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException('الموظف غير موجود');
        }

        return user;
    }

    async create(ctCenterId: string, dto: CreateUserDto) {
        // Check for duplicate email
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
        }

        // Validate role (can only create employees from CT center)
        if (dto.role === UserRole.SUPER_ADMIN) {
            throw new ConflictException('لا يمكن إنشاء مدير عام');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        return this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
                role: dto.role,
                ctCenterId,
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });
    }

    async update(ctCenterId: string, id: string, dto: UpdateUserDto) {
        await this.findOne(ctCenterId, id);

        // Remove permissions from dto since it doesn't exist in schema
        const { permissions: _, ...updateData } = dto as any;

        return this.prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                updatedAt: true,
            },
        });
    }

    async remove(ctCenterId: string, id: string) {
        await this.findOne(ctCenterId, id);

        await this.prisma.user.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
    }

    async toggleActive(ctCenterId: string, id: string) {
        const user = await this.findOne(ctCenterId, id);

        return this.prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive },
            select: {
                id: true,
                isActive: true,
            },
        });
    }

    async resetPassword(ctCenterId: string, id: string, newPassword: string) {
        await this.findOne(ctCenterId, id);

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
            where: { id },
            data: { password: hashedPassword },
        });

        return { message: 'تم تغيير كلمة المرور بنجاح' };
    }

    async getStats(ctCenterId: string) {
        const [total, active, byRole] = await Promise.all([
            this.prisma.user.count({ where: { ctCenterId, deletedAt: null } }),
            this.prisma.user.count({ where: { ctCenterId, isActive: true, deletedAt: null } }),
            this.prisma.user.groupBy({
                by: ['role'],
                where: { ctCenterId, deletedAt: null },
                _count: true,
            }),
        ]);

        return {
            total,
            active,
            inactive: total - active,
            byRole: byRole.reduce((acc, r) => ({ ...acc, [r.role]: r._count }), {}),
        };
    }
}
