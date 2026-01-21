import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
    constructor(private prisma: PrismaService) { }

    async getContacts(userId: string, ctCenterId?: string) {
        // Get all unique users that the current user has chatted with
        const sentMessages = await this.prisma.chatMessage.findMany({
            where: { senderId: userId },
            select: { receiverId: true },
            distinct: ['receiverId'],
        });

        const receivedMessages = await this.prisma.chatMessage.findMany({
            where: { receiverId: userId },
            select: { senderId: true },
            distinct: ['senderId'],
        });

        const contactIds = new Set([
            ...sentMessages.map(m => m.receiverId),
            ...receivedMessages.map(m => m.senderId),
        ]);

        const contacts = await this.prisma.user.findMany({
            where: { id: { in: Array.from(contactIds) } },
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        });

        // Get last message for each contact
        const result = await Promise.all(
            contacts.map(async (contact) => {
                const lastMessage = await this.prisma.chatMessage.findFirst({
                    where: {
                        OR: [
                            { senderId: userId, receiverId: contact.id },
                            { senderId: contact.id, receiverId: userId },
                        ],
                    },
                    orderBy: { createdAt: 'desc' },
                });

                const unreadCount = await this.prisma.chatMessage.count({
                    where: { senderId: contact.id, receiverId: userId, isRead: false },
                });

                return {
                    id: contact.id,
                    name: `${contact.firstName} ${contact.lastName}`,
                    avatar: contact.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.firstName}`,
                    message: lastMessage?.content || '',
                    time: lastMessage?.createdAt || new Date(),
                    online: true,
                    unreadCount,
                };
            })
        );

        return result.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    }

    async getMessages(userId: string, contactId: string) {
        const messages = await this.prisma.chatMessage.findMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: contactId },
                    { senderId: contactId, receiverId: userId },
                ],
            },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Mark messages as read
        await this.prisma.chatMessage.updateMany({
            where: { senderId: contactId, receiverId: userId, isRead: false },
            data: { isRead: true },
        });

        return messages.map(msg => ({
            id: msg.id,
            text: msg.content,
            type: 'text',
            sender: msg.senderId === userId ? 'me' : 'other',
            time: msg.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        }));
    }

    async sendMessage(senderId: string, receiverId: string, content: string, ctCenterId: string) {
        return this.prisma.chatMessage.create({
            data: {
                senderId,
                receiverId,
                content,
                ctCenterId,
            },
        });
    }

    async getUsers(currentUserId: string, search?: string) {
        const where: any = { id: { not: currentUserId }, isActive: true };
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const users = await this.prisma.user.findMany({
            where,
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
            take: 20,
        });

        return users.map(u => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
            avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.firstName}`,
        }));
    }
}
