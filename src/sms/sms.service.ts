import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) { }

    async sendSms(to: string, message: string, ctCenterId: string): Promise<boolean> {
        const center = await this.prisma.cTCenter.findUnique({ where: { id: ctCenterId } });
        if (!center) return false;

        const apiKey = center.smsApiKey || this.configService.get<string>('SWEEGO_API_KEY');
        if (!apiKey) {
            this.logger.warn(`No SMS API key configured for center ${ctCenterId}`);
            return false;
        }

        try {
            const response = await fetch('https://api.sweego.io/v1/sms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Api-Key': apiKey,
                },
                body: JSON.stringify({
                    from: center.smsSenderName || 'AgendaCT',
                    to: [to],
                    text: message,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                this.logger.error(`Sweego SMS failed: ${response.status} - ${errorBody}`);
                return false;
            }

            await this.trackUsage(ctCenterId);
            this.logger.log(`SMS sent to ${to} for center ${ctCenterId}`);
            return true;
        } catch (error: any) {
            this.logger.error(`SMS sending error: ${error.message}`);
            return false;
        }
    }

    async sendTemplatedSms(
        to: string,
        templateId: string,
        variables: Record<string, string>,
        ctCenterId: string,
    ): Promise<boolean> {
        const template = await this.prisma.sMSTemplate.findFirst({
            where: { id: templateId, ctCenterId },
        });

        if (!template) {
            this.logger.warn(`SMS template ${templateId} not found`);
            return false;
        }

        let message = template.content;
        for (const [key, value] of Object.entries(variables)) {
            message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        return this.sendSms(to, message, ctCenterId);
    }

    async getUsage(ctCenterId: string, month?: string) {
        const now = new Date();
        const targetMonth = month ? new Date(month + '-01') : new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 1);

        const usage = await this.prisma.smsUsage.findFirst({
            where: {
                ctCenterId,
                month: {
                    gte: targetMonth,
                    lt: nextMonth,
                },
            },
        });

        return {
            sentCount: usage?.sentCount || 0,
            quota: usage?.quota || 100,
            month: targetMonth.toISOString().slice(0, 7),
        };
    }

    private async trackUsage(ctCenterId: string) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const existing = await this.prisma.smsUsage.findFirst({
            where: {
                ctCenterId,
                month: monthStart,
            },
        });

        if (existing) {
            await this.prisma.smsUsage.update({
                where: { id: existing.id },
                data: { sentCount: { increment: 1 } },
            });
        } else {
            await this.prisma.smsUsage.create({
                data: {
                    ctCenterId,
                    month: monthStart,
                    sentCount: 1,
                },
            });
        }
    }
}
