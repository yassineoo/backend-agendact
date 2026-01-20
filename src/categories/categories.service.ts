import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService {
    constructor(private prisma: PrismaService) { }

    async findAll(ctCenterId: string, includeInactive = false) {
        return this.prisma.category.findMany({
            where: {
                ctCenterId,
                deletedAt: null,
                ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: { sortOrder: 'asc' },
        });
    }

    async findOne(ctCenterId: string, id: string) {
        const category = await this.prisma.category.findFirst({
            where: { id, ctCenterId, deletedAt: null },
        });

        if (!category) {
            throw new NotFoundException('الفئة غير موجودة');
        }

        return category;
    }

    async create(ctCenterId: string, dto: CreateCategoryDto) {
        // Get max sort order
        const maxOrder = await this.prisma.category.aggregate({
            where: { ctCenterId },
            _max: { sortOrder: true },
        });

        return this.prisma.category.create({
            data: {
                ...dto,
                ctCenterId,
                sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            },
        });
    }

    async update(ctCenterId: string, id: string, dto: UpdateCategoryDto) {
        await this.findOne(ctCenterId, id);

        return this.prisma.category.update({
            where: { id },
            data: dto,
        });
    }

    async remove(ctCenterId: string, id: string) {
        await this.findOne(ctCenterId, id);

        // Check for reservations
        const reservationsCount = await this.prisma.reservation.count({
            where: { categoryId: id },
        });

        if (reservationsCount > 0) {
            // Soft delete
            await this.prisma.category.update({
                where: { id },
                data: { deletedAt: new Date(), isActive: false },
            });
        } else {
            // Hard delete
            await this.prisma.category.delete({
                where: { id },
            });
        }
    }

    async toggleActive(ctCenterId: string, id: string) {
        const category = await this.findOne(ctCenterId, id);

        return this.prisma.category.update({
            where: { id },
            data: { isActive: !category.isActive },
        });
    }

    async reorder(ctCenterId: string, categories: { id: string; sortOrder: number }[]) {
        await this.prisma.$transaction(
            categories.map(({ id, sortOrder }) =>
                this.prisma.category.update({
                    where: { id },
                    data: { sortOrder },
                }),
            ),
        );

        return this.findAll(ctCenterId, true);
    }

    async duplicate(ctCenterId: string, id: string) {
        const original = await this.findOne(ctCenterId, id);

        // Get max sort order
        const maxOrder = await this.prisma.category.aggregate({
            where: { ctCenterId },
            _max: { sortOrder: true },
        });

        return this.prisma.category.create({
            data: {
                ctCenterId,
                name: `${original.name} (نسخة)`,
                description: original.description,
                color: original.color,
                icon: original.icon,
                duration: original.duration,
                price: original.price,
                isActive: true,
                sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            },
        });
    }
}
