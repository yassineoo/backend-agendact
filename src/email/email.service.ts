import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(EmailService.name);

    constructor(private configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST'),
            port: parseInt(this.configService.get('SMTP_PORT') || '587'),
            secure: false,
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            },
        });
    }

    async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
        try {
            await this.transporter.sendMail({
                from: this.configService.get('EMAIL_FROM') || 'noreply@agendact.com',
                to,
                subject,
                html,
            });
            this.logger.log(`Email sent to ${to}: ${subject}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Email sending failed: ${error.message}`);
            return false;
        }
    }

    async sendReservationConfirmation(to: string, data: {
        clientName: string;
        date: string;
        time: string;
        vehicleInfo: string;
        centerName: string;
    }): Promise<boolean> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a73e8;">تأكيد الحجز - ${data.centerName}</h2>
                <p>مرحباً ${data.clientName},</p>
                <p>تم تأكيد حجزك بنجاح:</p>
                <ul>
                    <li><strong>التاريخ:</strong> ${data.date}</li>
                    <li><strong>الوقت:</strong> ${data.time}</li>
                    <li><strong>المركبة:</strong> ${data.vehicleInfo}</li>
                </ul>
                <p>شكراً لاختياركم ${data.centerName}.</p>
            </div>
        `;
        return this.sendEmail(to, `تأكيد الحجز - ${data.centerName}`, html);
    }

    async sendReservationReminder(to: string, data: {
        clientName: string;
        date: string;
        time: string;
        centerName: string;
    }): Promise<boolean> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a73e8;">تذكير بالحجز - ${data.centerName}</h2>
                <p>مرحباً ${data.clientName},</p>
                <p>نذكركم بموعدكم غداً:</p>
                <ul>
                    <li><strong>التاريخ:</strong> ${data.date}</li>
                    <li><strong>الوقت:</strong> ${data.time}</li>
                </ul>
                <p>نتطلع لرؤيتكم.</p>
            </div>
        `;
        return this.sendEmail(to, `تذكير بالحجز - ${data.centerName}`, html);
    }
}
