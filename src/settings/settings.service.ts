import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCTCenterSettingsDto, UpdateOpeningHoursDto } from './dto';

@Injectable()
export class SettingsService {
    constructor(private prisma: PrismaService) { }

    async getCTCenterSettings(ctCenterId: string) {
        const center = await this.prisma.cTCenter.findUnique({
            where: { id: ctCenterId },
            include: {
                owner: { select: { id: true, firstName: true, lastName: true, email: true } },
                subscriptions: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                    orderBy: { endDate: 'desc' },
                    include: { plan: true },
                },
            },
        });

        if (!center) {
            throw new NotFoundException('المركز غير موجود');
        }

        const settings = await this.prisma.setting.findMany({
            where: { ctCenterId },
        });

        return {
            center: {
                id: center.id,
                name: center.name,
                slug: center.slug,
                address: center.address,
                city: center.city,
                postalCode: center.postalCode,
                phone: center.phone,
                email: center.email,
                logo: center.logo,
                openingHours: center.openingHours,
                timezone: center.timezone,
                currency: center.currency,
                isActive: center.isActive,
            },
            owner: center.owner,
            subscription: center.subscriptions[0] || null,
            settings: settings.reduce((acc, s) => ({
                ...acc,
                [s.key]: s.value,
            }), {}),
        };
    }

    async updateCTCenterSettings(ctCenterId: string, dto: UpdateCTCenterSettingsDto) {
        return this.prisma.cTCenter.update({
            where: { id: ctCenterId },
            data: dto,
        });
    }

    async updateOpeningHours(ctCenterId: string, dto: UpdateOpeningHoursDto) {
        return this.prisma.cTCenter.update({
            where: { id: ctCenterId },
            data: { openingHours: dto as any },
        });
    }

    async getSetting(ctCenterId: string, key: string) {
        const setting = await this.prisma.setting.findFirst({
            where: { ctCenterId, key },
        });

        if (!setting) return null;
        try {
            return JSON.parse(setting.value as string);
        } catch {
            return setting.value;
        }
    }

    async updateSetting(ctCenterId: string, key: string, value: any) {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

        const existing = await this.prisma.setting.findFirst({
            where: { ctCenterId, key },
        });

        if (existing) {
            return this.prisma.setting.update({
                where: { id: existing.id },
                data: { value: stringValue },
            });
        }

        return this.prisma.setting.create({
            data: {
                ctCenterId,
                key,
                value: stringValue,
            },
        });
    }

    async getPaymentMethods(ctCenterId: string) {
        const setting = await this.getSetting(ctCenterId, 'paymentMethods');
        return setting || {
            cash: { enabled: true, name: 'نقداً' },
            card: { enabled: true, name: 'بطاقة ائتمان' },
            bank_transfer: { enabled: false, name: 'تحويل بنكي' },
        };
    }

    async updatePaymentMethods(ctCenterId: string, methods: Record<string, any>) {
        return this.updateSetting(ctCenterId, 'paymentMethods', methods);
    }

    async getTrash(ctCenterId: string) {
        const [clients, vehicles, categories, reservations] = await Promise.all([
            this.prisma.client.findMany({
                where: { ctCenterId, deletedAt: { not: null } },
                select: { id: true, firstName: true, lastName: true, deletedAt: true },
                take: 50,
            }),
            this.prisma.vehicle.findMany({
                where: { ctCenterId, deletedAt: { not: null } },
                select: { id: true, plateNumber: true, brand: true, model: true, deletedAt: true },
                take: 50,
            }),
            this.prisma.category.findMany({
                where: { ctCenterId, deletedAt: { not: null } },
                select: { id: true, name: true, deletedAt: true },
                take: 50,
            }),
            this.prisma.reservation.findMany({
                where: { ctCenterId, deletedAt: { not: null } },
                select: { id: true, bookingCode: true, deletedAt: true },
                take: 50,
            }),
        ]);

        return { clients, vehicles, categories, reservations };
    }

    async restoreFromTrash(ctCenterId: string, type: string, id: string) {
        const models: Record<string, any> = {
            client: this.prisma.client,
            vehicle: this.prisma.vehicle,
            category: this.prisma.category,
            reservation: this.prisma.reservation,
        };

        const model = models[type];
        if (!model) {
            throw new NotFoundException('نوع غير صالح');
        }

        const item = await model.findFirst({
            where: { id, ctCenterId, deletedAt: { not: null } },
        });

        if (!item) {
            throw new NotFoundException('العنصر غير موجود');
        }

        return model.update({
            where: { id },
            data: { deletedAt: null },
        });
    }

    async permanentDelete(ctCenterId: string, type: string, id: string) {
        const models: Record<string, any> = {
            client: this.prisma.client,
            vehicle: this.prisma.vehicle,
            category: this.prisma.category,
        };

        const model = models[type];
        if (!model) {
            throw new NotFoundException('نوع غير صالح');
        }

        return model.delete({
            where: { id },
        });
    }

    async emptyTrash(ctCenterId: string) {
        await this.prisma.$transaction([
            this.prisma.client.deleteMany({
                where: { ctCenterId, deletedAt: { not: null } },
            }),
            this.prisma.vehicle.deleteMany({
                where: { ctCenterId, deletedAt: { not: null } },
            }),
            this.prisma.category.deleteMany({
                where: { ctCenterId, deletedAt: { not: null } },
            }),
        ]);

        return { message: 'تم إفراغ سلة المحذوفات' };
    }
}
