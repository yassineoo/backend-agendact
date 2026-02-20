import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrestationDto, UpdatePrestationDto } from './dto';
import { VehicleClass } from '@prisma/client';

@Injectable()
export class PrestationsService {
    constructor(private prisma: PrismaService) { }

    async findAll(ctCenterId: string, includeInactive = false, vehicleClass?: VehicleClass) {
        return this.prisma.prestation.findMany({
            where: {
                ctCenterId,
                deletedAt: null,
                ...(includeInactive ? {} : { isActive: true }),
                ...(vehicleClass ? { vehicleClass } : {}),
            },
            include: {
                categories: {
                    select: { id: true, name: true, vehicleClass: true },
                },
            },
            orderBy: { sortOrder: 'asc' },
        });
    }

    async findOne(ctCenterId: string, id: string) {
        const prestation = await this.prisma.prestation.findFirst({
            where: { id, ctCenterId, deletedAt: null },
            include: {
                categories: {
                    select: { id: true, name: true, vehicleClass: true },
                },
            },
        });

        if (!prestation) {
            throw new NotFoundException('Prestation non trouvée');
        }

        return prestation;
    }

    async create(ctCenterId: string, dto: CreatePrestationDto) {
        const { categoryIds, ...data } = dto;

        // Get max sort order
        const maxOrder = await this.prisma.prestation.aggregate({
            where: { ctCenterId },
            _max: { sortOrder: true },
        });

        return this.prisma.prestation.create({
            data: {
                ...data,
                ctCenterId,
                sortOrder: (maxOrder._max.sortOrder || 0) + 1,
                ...(categoryIds?.length ? {
                    categories: {
                        connect: categoryIds.map(id => ({ id })),
                    },
                } : {}),
            },
            include: {
                categories: {
                    select: { id: true, name: true, vehicleClass: true },
                },
            },
        });
    }

    async update(ctCenterId: string, id: string, dto: UpdatePrestationDto) {
        await this.findOne(ctCenterId, id);

        const { categoryIds, ...data } = dto;

        return this.prisma.prestation.update({
            where: { id },
            data: {
                ...data,
                ...(categoryIds !== undefined ? {
                    categories: {
                        set: categoryIds.map(cid => ({ id: cid })),
                    },
                } : {}),
            },
            include: {
                categories: {
                    select: { id: true, name: true, vehicleClass: true },
                },
            },
        });
    }

    async remove(ctCenterId: string, id: string) {
        await this.findOne(ctCenterId, id);

        // Soft delete
        await this.prisma.prestation.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
    }

    async toggleActive(ctCenterId: string, id: string) {
        const prestation = await this.findOne(ctCenterId, id);

        return this.prisma.prestation.update({
            where: { id },
            data: { isActive: !prestation.isActive },
        });
    }

    async reorder(ctCenterId: string, items: { id: string; sortOrder: number }[]) {
        await this.prisma.$transaction(
            items.map(({ id, sortOrder }) =>
                this.prisma.prestation.update({
                    where: { id },
                    data: { sortOrder },
                }),
            ),
        );

        return this.findAll(ctCenterId, true);
    }
}
