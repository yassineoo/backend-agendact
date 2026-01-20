import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto, ClientFilterDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
    constructor(private prisma: PrismaService) { }

    async findAll(ctCenterId: string, filter: ClientFilterDto) {
        const where: Prisma.ClientWhereInput = {
            ctCenterId,
            deletedAt: null,
        };

        if (filter.type) {
            where.type = filter.type;
        }

        if (filter.search) {
            where.OR = [
                { firstName: { contains: filter.search, mode: 'insensitive' } },
                { lastName: { contains: filter.search, mode: 'insensitive' } },
                { email: { contains: filter.search, mode: 'insensitive' } },
                { phone: { contains: filter.search } },
                { companyName: { contains: filter.search, mode: 'insensitive' } },
            ];
        }

        const [total, items] = await Promise.all([
            this.prisma.client.count({ where }),
            this.prisma.client.findMany({
                where,
                include: {
                    _count: { select: { vehicles: true, reservations: true } },
                },
                orderBy: { [filter.sortBy || 'createdAt']: filter.sortOrder || 'desc' },
                skip: ((filter.page || 1) - 1) * (filter.limit || 20),
                take: filter.limit || 20,
            }),
        ]);

        return {
            items,
            total,
            page: filter.page || 1,
            limit: filter.limit || 20,
            totalPages: Math.ceil(total / (filter.limit || 20)),
        };
    }

    async findOne(ctCenterId: string, id: string) {
        const client = await this.prisma.client.findFirst({
            where: { id, ctCenterId, deletedAt: null },
            include: {
                vehicles: { where: { deletedAt: null } },
                reservations: {
                    take: 10,
                    orderBy: { date: 'desc' },
                    include: { category: true },
                },
            },
        });

        if (!client) {
            throw new NotFoundException('العميل غير موجود');
        }

        return client;
    }

    async create(ctCenterId: string, dto: CreateClientDto) {
        // Check for duplicate email
        const existing = await this.prisma.client.findFirst({
            where: { ctCenterId, email: dto.email, deletedAt: null },
        });

        if (existing) {
            throw new ConflictException('عميل بهذا البريد موجود بالفعل');
        }

        return this.prisma.client.create({
            data: { ...dto, ctCenterId },
        });
    }

    async update(ctCenterId: string, id: string, dto: UpdateClientDto) {
        await this.findOne(ctCenterId, id);

        if (dto.email) {
            const existing = await this.prisma.client.findFirst({
                where: {
                    ctCenterId,
                    email: dto.email,
                    id: { not: id },
                    deletedAt: null,
                },
            });

            if (existing) {
                throw new ConflictException('عميل بهذا البريد موجود بالفعل');
            }
        }

        return this.prisma.client.update({
            where: { id },
            data: dto,
        });
    }

    async remove(ctCenterId: string, id: string) {
        await this.findOne(ctCenterId, id);

        // Soft delete
        await this.prisma.client.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async getVehicles(ctCenterId: string, clientId: string) {
        await this.findOne(ctCenterId, clientId);

        return this.prisma.vehicle.findMany({
            where: { clientId, deletedAt: null },
        });
    }

    async addLoyaltyPoints(ctCenterId: string, clientId: string, points: number) {
        await this.findOne(ctCenterId, clientId);

        return this.prisma.client.update({
            where: { id: clientId },
            data: { loyaltyPoints: { increment: points } },
        });
    }
}
