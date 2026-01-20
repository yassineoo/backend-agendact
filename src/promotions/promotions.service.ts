import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto, UpdatePromotionDto, ValidatePromoCodeDto } from './dto';
import { DiscountType } from '@prisma/client';

@Injectable()
export class PromotionsService {
    constructor(private prisma: PrismaService) { }

    async findAll(ctCenterId: string, includeInactive = false) {
        return this.prisma.promotion.findMany({
            where: {
                ctCenterId,
                deletedAt: null,
                ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(ctCenterId: string, id: string) {
        const promotion = await this.prisma.promotion.findFirst({
            where: { id, ctCenterId, deletedAt: null },
        });

        if (!promotion) {
            throw new NotFoundException('العرض غير موجود');
        }

        return promotion;
    }

    async create(ctCenterId: string, dto: CreatePromotionDto) {
        // Check for duplicate code
        const existing = await this.prisma.promotion.findFirst({
            where: { ctCenterId, code: dto.code, deletedAt: null },
        });

        if (existing) {
            throw new ConflictException('كود الخصم مستخدم بالفعل');
        }

        return this.prisma.promotion.create({
            data: {
                ctCenterId,
                name: dto.name,
                description: dto.description,
                code: dto.code,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                usageLimit: dto.usageLimit,
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate),
                isActive: true,
                usedCount: 0,
            },
        });
    }

    async update(ctCenterId: string, id: string, dto: UpdatePromotionDto) {
        await this.findOne(ctCenterId, id);

        return this.prisma.promotion.update({
            where: { id },
            data: {
                ...dto,
                startDate: dto.startDate ? new Date(dto.startDate) : undefined,
                endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            },
        });
    }

    async remove(ctCenterId: string, id: string) {
        await this.findOne(ctCenterId, id);

        await this.prisma.promotion.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async toggleActive(ctCenterId: string, id: string) {
        const promotion = await this.findOne(ctCenterId, id);

        return this.prisma.promotion.update({
            where: { id },
            data: { isActive: !promotion.isActive },
        });
    }

    async validateCode(ctCenterId: string, dto: ValidatePromoCodeDto) {
        const promotion = await this.prisma.promotion.findFirst({
            where: {
                ctCenterId,
                code: dto.code,
                isActive: true,
                deletedAt: null,
            },
        });

        if (!promotion) {
            throw new BadRequestException('كود الخصم غير صالح');
        }

        const now = new Date();
        if (now < promotion.startDate || now > promotion.endDate) {
            throw new BadRequestException('كود الخصم منتهي أو لم يبدأ بعد');
        }

        if (promotion.usageLimit && promotion.usedCount >= promotion.usageLimit) {
            throw new BadRequestException('تم استنفاد عدد الاستخدامات المسموح بها');
        }

        // Calculate discount
        let discountAmount = 0;
        if (dto.amount) {
            if (promotion.discountType === DiscountType.PERCENTAGE) {
                discountAmount = (dto.amount * Number(promotion.discountValue)) / 100;
            } else {
                discountAmount = Number(promotion.discountValue);
            }
        }

        return {
            valid: true,
            promotion: {
                id: promotion.id,
                name: promotion.name,
                code: promotion.code,
                discountType: promotion.discountType,
                discountValue: promotion.discountValue,
            },
            discountAmount,
            finalAmount: dto.amount ? dto.amount - discountAmount : undefined,
        };
    }

    async applyPromotion(ctCenterId: string, promotionId: string) {
        await this.findOne(ctCenterId, promotionId);

        return this.prisma.promotion.update({
            where: { id: promotionId },
            data: { usedCount: { increment: 1 } },
        });
    }

    async getStats(ctCenterId: string) {
        const [total, active, expired, totalUsage] = await Promise.all([
            this.prisma.promotion.count({ where: { ctCenterId, deletedAt: null } }),
            this.prisma.promotion.count({
                where: {
                    ctCenterId,
                    isActive: true,
                    endDate: { gte: new Date() },
                    deletedAt: null,
                },
            }),
            this.prisma.promotion.count({
                where: {
                    ctCenterId,
                    endDate: { lt: new Date() },
                    deletedAt: null,
                },
            }),
            this.prisma.promotion.aggregate({
                where: { ctCenterId, deletedAt: null },
                _sum: { usedCount: true },
            }),
        ]);

        return {
            total,
            active,
            expired,
            totalUsage: totalUsage._sum?.usedCount || 0,
        };
    }
}
