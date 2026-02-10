import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
    constructor(private prisma: PrismaService) { }

    async create(
        userId: string,
        title: string,
        message: string,
        type: NotificationType = 'SYSTEM',
        data?: any,
    ) {
        return this.prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                data: data ? JSON.stringify(data) : undefined,
            },
        });
    }

    async findAll(userId: string, params?: { unreadOnly?: boolean; page?: number; limit?: number }) {
        const page = params?.page || 1;
        const limit = params?.limit || 20;

        const where: any = { userId };
        if (params?.unreadOnly) {
            where.isRead = false;
        }

        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.notification.count({ where }),
        ]);

        return {
            data: notifications,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getUnreadCount(userId: string): Promise<{ count: number }> {
        const count = await this.prisma.notification.count({
            where: { userId, isRead: false },
        });
        return { count };
    }

    async markAsRead(userId: string, notificationId: string) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }

    async delete(userId: string, notificationId: string) {
        return this.prisma.notification.deleteMany({
            where: { id: notificationId, userId },
        });
    }
}
