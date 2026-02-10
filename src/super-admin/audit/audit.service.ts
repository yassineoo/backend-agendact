import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminAuditService {
    constructor(private prisma: PrismaService) { }

    async log(data: {
        userId: string;
        action: string;
        entity: string;
        entityId?: string;
        oldData?: any;
        newData?: any;
        ctCenterId?: string;
        ipAddress?: string;
    }) {
        return this.prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                oldData: data.oldData,
                newData: data.newData,
                ctCenterId: data.ctCenterId,
                ipAddress: data.ipAddress,
            },
        });
    }

    async findAll(params?: {
        page?: number;
        limit?: number;
        userId?: string;
        action?: string;
        entity?: string;
        ctCenterId?: string;
    }) {
        const page = params?.page || 1;
        const limit = params?.limit || 50;

        const where: any = {};
        if (params?.userId) where.userId = params.userId;
        if (params?.action) where.action = params.action;
        if (params?.entity) where.entity = params.entity;
        if (params?.ctCenterId) where.ctCenterId = params.ctCenterId;

        const [logs, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return { data: logs, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}
