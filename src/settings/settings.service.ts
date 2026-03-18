import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCTCenterSettingsDto, UpdateOpeningHoursDto } from './dto';

@Injectable()
export class SettingsService {
    constructor(private prisma: PrismaService) { }

    // ─── Create Center ────────────────────────────────────────────────────────

    async createCenter(ownerId: string, data: any) {
        const slug = (data.name || 'center')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            + '-' + Date.now().toString(36);

        return this.prisma.cTCenter.create({
            data: {
                name: data.name,
                slug,
                address: data.address || '',
                city: data.city || '',
                postalCode: data.postalCode || '',
                phone: data.phone || '',
                email: data.email || '',
                siret: data.siret,
                brand: data.brand,
                logo: data.logo,
                coverImage: data.coverImage,
                isActive: data.isActive ?? true,
                ownerId,
            },
            select: {
                id: true, name: true, slug: true, address: true, city: true,
                postalCode: true, phone: true, email: true, logo: true,
                siret: true, brand: true, isActive: true,
            },
        });
    }

    async deleteCenter(ctCenterId: string) {
        return this.prisma.cTCenter.update({
            where: { id: ctCenterId },
            data: { isActive: false },
        });
    }

    // ─── Center Config (categories, lines, visibility, iframe) ────────────────

    async getCenterConfig(ctCenterId: string) {
        const stored = await this.getSetting(ctCenterId, 'centerConfig');
        return stored || {
            vlCategories: { technicalInspection: true, voluntaryControl: true },
            lCategories: { garageVolunteer: true, technicalInspection: true },
            lines: [],
            visibleOnWeb: true,
            paymentStatusActive: true,
            urlIframe: '',
        };
    }

    async updateCenterConfig(ctCenterId: string, data: any) {
        await this.updateSetting(ctCenterId, 'centerConfig', data);
        return { message: 'Center config updated', data };
    }

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
                siret: center.siret,
                siren: center.siren,
                approvalNumber: center.approvalNumber,
                brand: center.brand,
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
            select: {
                id: true, name: true, address: true, city: true, postalCode: true,
                phone: true, email: true, logo: true, siret: true, brand: true,
            },
        });
    }

    async updateOpeningHours(ctCenterId: string, dto: UpdateOpeningHoursDto) {
        return this.prisma.cTCenter.update({
            where: { id: ctCenterId },
            data: { openingHours: dto as any },
            select: { id: true, openingHours: true },
        });
    }

    async updateBusinessRules(ctCenterId: string, rules: Record<string, boolean>) {
        // Persist each business rule as an individual Setting key-value record
        const updates = Object.entries(rules).map(([key, value]) =>
            this.updateSetting(ctCenterId, key, value)
        );
        await Promise.all(updates);
        return { message: 'Business rules updated', rules };
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
        const jsonValue = typeof value === 'object' ? value : value;

        const existing = await this.prisma.setting.findFirst({
            where: { ctCenterId, key },
        });

        if (existing) {
            return this.prisma.setting.update({
                where: { id: existing.id },
                data: { value: jsonValue },
            });
        }

        return this.prisma.setting.create({
            data: { ctCenterId, key, value: jsonValue },
        });
    }

    async getPaymentMethods(ctCenterId: string) {
        const setting = await this.getSetting(ctCenterId, 'paymentMethods');
        return setting || {
            cash: { enabled: true, name: 'Cash' },
            card: { enabled: true, name: 'Bank Card' },
            check: { enabled: false, name: 'Check' },
            bank_transfer: { enabled: false, name: 'Bank Transfer' },
        };
    }

    async updatePaymentMethods(ctCenterId: string, methods: Record<string, any>) {
        return this.updateSetting(ctCenterId, 'paymentMethods', methods);
    }

    async getLandingPage(ctCenterId: string) {
        const landingPage = await this.prisma.landingPage.findUnique({
            where: { ctCenterId },
        });
        return landingPage || {
            ctCenterId,
            templateId: 1,
            config: {},
            isPublished: false,
        };
    }

    // Public: get landing page + center info by slug (no auth needed)
    async getLandingPagePublic(slug: string) {
        const center = await this.prisma.cTCenter.findFirst({
            where: { slug, isActive: true },
            select: {
                id: true,
                name: true,
                slug: true,
                address: true,
                city: true,
                postalCode: true,
                phone: true,
                email: true,
                logo: true,
                coverImage: true,
                openingHours: true,
            },
        });
        if (!center) return null;

        const landingPage = await this.prisma.landingPage.findUnique({
            where: { ctCenterId: center.id },
        });

        return {
            center,
            landingPage: landingPage || {
                templateId: 1,
                config: {},
                isPublished: false,
            },
        };
    }

    async updateLandingPage(ctCenterId: string, data: any) {
        const { templateId, config, isPublished, seoTitle, seoDescription, customDomain } = data;

        // Auto-set subdomain from center slug if not explicitly provided
        let domain = customDomain;
        if (domain === undefined || domain === null || domain === '') {
            const center = await this.prisma.cTCenter.findUnique({
                where: { id: ctCenterId },
                select: { slug: true },
            });
            if (center?.slug) {
                domain = center.slug;
            }
        }

        return this.prisma.landingPage.upsert({
            where: { ctCenterId },
            create: {
                ctCenterId,
                templateId: templateId ?? 1,
                config: config ?? {},
                isPublished: isPublished ?? false,
                seoTitle,
                seoDescription,
                customDomain: domain,
            },
            update: {
                ...(templateId !== undefined && { templateId }),
                ...(config !== undefined && { config }),
                ...(isPublished !== undefined && { isPublished }),
                ...(seoTitle !== undefined && { seoTitle }),
                ...(seoDescription !== undefined && { seoDescription }),
                ...(domain !== undefined && { customDomain: domain }),
            },
        });
    }

    async getTrash(ctCenterId: string) {
        const [clients, vehicles, categories, reservations] = await Promise.all([
            this.prisma.client.findMany({
                where: { ctCenterId, deletedAt: { not: null } },
                select: { id: true, firstName: true, lastName: true, email: true, phone: true, deletedAt: true },
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
                select: {
                    id: true, bookingCode: true, deletedAt: true, date: true,
                    client: { select: { firstName: true, lastName: true } },
                    vehicle: { select: { plateNumber: true, brand: true, model: true } },
                    category: { select: { name: true } },
                },
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
            throw new NotFoundException('Invalid type');
        }

        const item = await model.findFirst({
            where: { id, ctCenterId, deletedAt: { not: null } },
        });

        if (!item) {
            throw new NotFoundException('Item not found in trash');
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
            throw new NotFoundException('Invalid type');
        }

        return model.delete({ where: { id } });
    }

    async emptyTrash(ctCenterId: string) {
        await this.prisma.$transaction([
            this.prisma.client.deleteMany({ where: { ctCenterId, deletedAt: { not: null } } }),
            this.prisma.vehicle.deleteMany({ where: { ctCenterId, deletedAt: { not: null } } }),
            this.prisma.category.deleteMany({ where: { ctCenterId, deletedAt: { not: null } } }),
        ]);

        return { message: 'Trash emptied successfully' };
    }

    // ─── Regulatory Compliance ────────────────────────────────────────────────

    async getRegulatoryCompliance(ctCenterId: string) {
        const stored = await this.getSetting(ctCenterId, 'regulatoryCompliance');
        return stored || {
            connectionType: 'sftp',
            sftp: { host: '', port: '22', id: '', password: '', remoteFolder: '' },
            soap: { apiUrl: '', sftpId: '', password: '', tokenApi: '', validateXsd: false, compressZip: false },
            exportMode: 'scheduled',
            scheduleFrequency: 'daily',
            // Section D - Export Format
            selectedFormats: ['xml', 'xsd'],
            formatOptions: { validateXsd: true, compressZip: false },
            // Section H - Archiving
            archiveEnabled: false,
            archivePath: '',
            retentionDays: 365,
            // Center info
            utacCode: '',
            operatorCode: '',
        };
    }

    async updateRegulatoryCompliance(ctCenterId: string, data: any) {
        // Merge with existing so partial updates don't wipe other sections
        const existing = await this.getRegulatoryCompliance(ctCenterId);
        const merged = { ...existing, ...data };
        await this.updateSetting(ctCenterId, 'regulatoryCompliance', merged);
        return { message: 'Regulatory compliance settings updated', data: merged };
    }

    // ─── Document Types ───────────────────────────────────────────────────────

    private readonly DEFAULT_DOCUMENT_TYPES = [
        { id: 'doc-1', name: 'Registration Certificate (Carte Grise)', required: true, active: true, normalClient: true, proClient: true },
        { id: 'doc-2', name: 'Insurance Document', required: true, active: true, normalClient: true, proClient: true },
        { id: 'doc-3', name: 'Fitness to Drive', required: false, active: true, normalClient: false, proClient: false },
        { id: 'doc-4', name: 'ID Card', required: false, active: false, normalClient: false, proClient: false },
        { id: 'doc-5', name: 'Medical Certificate', required: false, active: false, normalClient: false, proClient: false },
    ];

    async getDocumentTypes(ctCenterId: string) {
        const stored = await this.getSetting(ctCenterId, 'documentTypes');
        return stored || this.DEFAULT_DOCUMENT_TYPES;
    }

    async createDocumentType(ctCenterId: string, data: any) {
        const current = await this.getDocumentTypes(ctCenterId);
        const newDoc = {
            id: `doc-${Date.now()}`,
            name: data.name,
            required: data.required ?? false,
            active: data.active ?? true,
            normalClient: data.normalClient ?? false,
            proClient: data.proClient ?? false,
        };
        const updated = [...current, newDoc];
        await this.updateSetting(ctCenterId, 'documentTypes', updated);
        return newDoc;
    }

    async updateDocumentType(ctCenterId: string, id: string, data: any) {
        const current = await this.getDocumentTypes(ctCenterId);
        const updated = current.map((doc: any) => doc.id === id ? { ...doc, ...data } : doc);
        await this.updateSetting(ctCenterId, 'documentTypes', updated);
        return updated.find((doc: any) => doc.id === id);
    }

    async deleteDocumentType(ctCenterId: string, id: string) {
        const current = await this.getDocumentTypes(ctCenterId);
        const updated = current.filter((doc: any) => doc.id !== id);
        await this.updateSetting(ctCenterId, 'documentTypes', updated);
        return { message: 'Document type deleted' };
    }

    // ─── Loyalty Card ─────────────────────────────────────────────────────────

    async getLoyaltyCard(ctCenterId: string) {
        const stored = await this.getSetting(ctCenterId, 'loyaltyCard');
        return stored || {
            isActivated: false,
            visitThreshold: 5,
            rewardText: '5th visit: -15%',
            stampCount: 4,
        };
    }

    async updateLoyaltyCard(ctCenterId: string, data: any) {
        await this.updateSetting(ctCenterId, 'loyaltyCard', data);
        return { message: 'Loyalty card settings updated', data };
    }

    // ─── Menu Settings ────────────────────────────────────────────────────────

    private readonly DEFAULT_MENU_ITEMS = [
        { id: 1, name: 'Dashboard', visible: true, active: true, order: 0 },
        { id: 2, name: 'Planning', visible: true, active: true, order: 1 },
        { id: 3, name: 'Categories & Prestations', visible: true, active: true, order: 2 },
        { id: 4, name: 'History Management', visible: true, active: true, order: 3 },
        { id: 5, name: 'Clients & Pros', visible: false, active: false, order: 4 },
        { id: 6, name: 'Access & Role', visible: true, active: false, order: 5 },
    ];

    async getMenuSettings(ctCenterId: string) {
        const menuItems = await this.getSetting(ctCenterId, 'menuItems');
        const externalLinks = await this.getSetting(ctCenterId, 'externalLinks');
        return {
            menuItems: menuItems || this.DEFAULT_MENU_ITEMS,
            externalLinks: externalLinks || [],
        };
    }

    async updateMenuSettings(ctCenterId: string, data: any) {
        if (data.menuItems !== undefined) {
            await this.updateSetting(ctCenterId, 'menuItems', data.menuItems);
        }
        if (data.externalLinks !== undefined) {
            await this.updateSetting(ctCenterId, 'externalLinks', data.externalLinks);
        }
        return { message: 'Menu settings updated' };
    }
}

