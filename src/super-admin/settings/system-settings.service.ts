import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SystemSettingsService {
    constructor(private prisma: PrismaService) { }

    async getAll() {
        const settings = await this.prisma.systemSetting.findMany({
            orderBy: { key: 'asc' },
        });

        return settings.reduce((acc, s) => ({
            ...acc,
            [s.key]: { value: s.value, label: s.label },
        }), {});
    }

    async get(key: string) {
        const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
        if (!setting) return null;
        return setting.value;
    }

    async set(key: string, value: any, label?: string) {
        const stringValue = typeof value === 'object' ? value : value;

        return this.prisma.systemSetting.upsert({
            where: { key },
            update: { value: stringValue, ...(label ? { label } : {}) },
            create: { key, value: stringValue, ...(label ? { label } : {}) },
        });
    }

    async delete(key: string) {
        const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
        if (!existing) throw new NotFoundException(`Setting '${key}' not found`);
        return this.prisma.systemSetting.delete({ where: { key } });
    }

    async bulkSet(settings: Record<string, any>) {
        const ops = Object.entries(settings).map(([key, value]) =>
            this.prisma.systemSetting.upsert({
                where: { key },
                update: { value },
                create: { key, value },
            }),
        );
        return this.prisma.$transaction(ops);
    }

    // Convenience methods for common platform settings
    async getMaintenanceMode(): Promise<boolean> {
        const val = await this.get('maintenance_mode');
        return val === true;
    }

    async setMaintenanceMode(enabled: boolean) {
        return this.set('maintenance_mode', enabled, 'Mode maintenance');
    }

    async getDefaultTrialDays(): Promise<number> {
        const val = await this.get('default_trial_days');
        return (val as number) || 14;
    }

    async getSmtpConfig() {
        return {
            provider: await this.get('email_provider') || 'sweego',
            apiKey: await this.get('sweego_api_key'),
            fromEmail: await this.get('email_from') || 'no-reply@agendact.com',
            fromName: await this.get('email_from_name') || 'AgendaCT',
        };
    }

    async getPlatformInfo() {
        return {
            platformName: await this.get('platform_name') || 'AgendaCT',
            platformUrl: await this.get('platform_url') || 'https://agendact.com',
            supportEmail: await this.get('support_email') || 'support@agendact.com',
            maintenanceMode: await this.getMaintenanceMode(),
            defaultTrialDays: await this.getDefaultTrialDays(),
        };
    }
}
