import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SweegoEmailPayload {
    from: { email: string; name?: string };
    to: { email: string; name?: string }[];
    subject: string;
    html: string;
    text?: string;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly apiKey: string;
    private readonly fromEmail: string;
    private readonly fromName: string;
    private readonly apiUrl = 'https://api.sweego.io/send';

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('SWEEGO_API_KEY') || '';
        this.fromEmail = 'no-reply@agendact.com';
        this.fromName = 'AgendaCT';
    }

    async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
        if (!this.apiKey) {
            this.logger.warn('Sweego API key not configured, skipping email');
            return false;
        }

        const payload: SweegoEmailPayload = {
            from: { email: this.fromEmail, name: this.fromName },
            to: [{ email: to }],
            subject,
            html,
            ...(text ? { text } : {}),
        };

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Api-Key': this.apiKey,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                this.logger.error(`Sweego email failed: ${response.status} - ${errorBody}`);
                return false;
            }

            this.logger.log(`Email sent to ${to}: ${subject}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Email sending error: ${error.message}`);
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
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#1a73e8,#4285f4);padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">✅ Réservation Confirmée</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${data.centerName}</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="font-size:16px;color:#333;">Bonjour <strong>${data.clientName}</strong>,</p>
        <p style="color:#555;line-height:1.6;">Votre réservation a été confirmée avec succès. Voici les détails :</p>
        <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #1a73e8;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#666;font-size:14px;">📅 Date</td><td style="padding:8px 0;color:#333;font-weight:600;text-align:right;">${data.date}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:14px;">🕐 Heure</td><td style="padding:8px 0;color:#333;font-weight:600;text-align:right;">${data.time}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:14px;">🚗 Véhicule</td><td style="padding:8px 0;color:#333;font-weight:600;text-align:right;">${data.vehicleInfo}</td></tr>
          </table>
        </div>
        <p style="color:#555;font-size:14px;line-height:1.6;">Si vous souhaitez modifier ou annuler votre réservation, veuillez nous contacter directement.</p>
      </div>
      <div style="background:#f8f9fa;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} ${data.centerName} — Propulsé par AgendaCT</p>
      </div>
    </div>
  </div>
</body>
</html>`;

        return this.sendEmail(to, `Confirmation de réservation — ${data.centerName}`, html);
    }

    async sendReservationReminder(to: string, data: {
        clientName: string;
        date: string;
        time: string;
        centerName: string;
    }): Promise<boolean> {
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#f59e0b,#f97316);padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">🔔 Rappel de Réservation</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${data.centerName}</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="font-size:16px;color:#333;">Bonjour <strong>${data.clientName}</strong>,</p>
        <p style="color:#555;line-height:1.6;">Nous vous rappelons votre rendez-vous de demain :</p>
        <div style="background:#fffbeb;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #f59e0b;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#666;font-size:14px;">📅 Date</td><td style="padding:8px 0;color:#333;font-weight:600;text-align:right;">${data.date}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:14px;">🕐 Heure</td><td style="padding:8px 0;color:#333;font-weight:600;text-align:right;">${data.time}</td></tr>
          </table>
        </div>
        <p style="color:#555;font-size:14px;">Nous avons hâte de vous accueillir !</p>
      </div>
      <div style="background:#f8f9fa;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} ${data.centerName} — Propulsé par AgendaCT</p>
      </div>
    </div>
  </div>
</body>
</html>`;

        return this.sendEmail(to, `Rappel : rendez-vous demain — ${data.centerName}`, html);
    }

    async sendStatusUpdate(to: string, data: {
        clientName: string;
        centerName: string;
        status: string;
        statusMessage: string;
        bookingCode?: string;
    }): Promise<boolean> {
        const statusColors: Record<string, string> = {
            CONFIRMED: '#22c55e',
            IN_PROGRESS: '#3b82f6',
            COMPLETED: '#8b5cf6',
            CANCELLED: '#ef4444',
        };
        const color = statusColors[data.status] || '#6b7280';

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:${color};padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">Mise à jour de votre réservation</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${data.centerName}</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="font-size:16px;color:#333;">Bonjour <strong>${data.clientName}</strong>,</p>
        <p style="color:#555;line-height:1.6;">${data.statusMessage}</p>
        ${data.bookingCode ? `<p style="color:#999;font-size:13px;">Code de réservation : <strong>${data.bookingCode}</strong></p>` : ''}
      </div>
      <div style="background:#f8f9fa;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} ${data.centerName} — Propulsé par AgendaCT</p>
      </div>
    </div>
  </div>
</body>
</html>`;

        return this.sendEmail(to, `${data.statusMessage} — ${data.centerName}`, html);
    }

    async sendPaymentReceipt(to: string, data: {
        clientName: string;
        centerName: string;
        amount: number;
        currency: string;
        date: string;
        invoiceNumber?: string;
    }): Promise<boolean> {
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">💰 Reçu de Paiement</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${data.centerName}</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="font-size:16px;color:#333;">Bonjour <strong>${data.clientName}</strong>,</p>
        <p style="color:#555;">Nous confirmons la réception de votre paiement :</p>
        <div style="background:#f0fdf4;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #22c55e;text-align:center;">
          <p style="font-size:32px;font-weight:700;color:#16a34a;margin:0;">${data.amount} ${data.currency}</p>
          <p style="color:#666;margin:8px 0 0;font-size:14px;">${data.date}</p>
          ${data.invoiceNumber ? `<p style="color:#999;font-size:13px;margin:4px 0 0;">Facture : ${data.invoiceNumber}</p>` : ''}
        </div>
        <p style="color:#555;font-size:14px;">Merci pour votre confiance.</p>
      </div>
      <div style="background:#f8f9fa;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} ${data.centerName} — Propulsé par AgendaCT</p>
      </div>
    </div>
  </div>
</body>
</html>`;

        return this.sendEmail(to, `Reçu de paiement — ${data.centerName}`, html);
    }

    async sendPromotionNotification(to: string, data: {
        clientName: string;
        centerName: string;
        promoName: string;
        promoCode?: string;
        discountValue: string;
        startDate: string;
        endDate: string;
    }): Promise<boolean> {
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#ec4899,#f43f5e);padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">🎉 Offre Spéciale</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${data.centerName}</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="font-size:16px;color:#333;">Bonjour <strong>${data.clientName}</strong>,</p>
        <p style="color:#555;line-height:1.6;">Profitez de notre offre promotionnelle :</p>
        <div style="background:#fdf2f8;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #ec4899;text-align:center;">
          <p style="font-size:20px;font-weight:700;color:#ec4899;margin:0;">${data.promoName}</p>
          <p style="font-size:28px;font-weight:800;color:#333;margin:8px 0;">${data.discountValue}</p>
          ${data.promoCode ? `<p style="background:#333;color:#fff;display:inline-block;padding:8px 20px;border-radius:6px;font-family:monospace;font-size:18px;letter-spacing:2px;margin:12px 0;">${data.promoCode}</p>` : ''}
          <p style="color:#999;font-size:13px;margin:8px 0 0;">Valable du ${data.startDate} au ${data.endDate}</p>
        </div>
        <p style="color:#555;font-size:14px;">Réservez dès maintenant pour en profiter !</p>
      </div>
      <div style="background:#f8f9fa;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} ${data.centerName} — Propulsé par AgendaCT</p>
      </div>
    </div>
  </div>
</body>
</html>`;

        return this.sendEmail(to, `${data.promoName} — ${data.centerName}`, html);
    }

    async sendHolidayNotification(to: string, data: {
        clientName: string;
        centerName: string;
        holidayName: string;
        date: string;
        endDate?: string;
    }): Promise<boolean> {
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">📌 Fermeture Exceptionnelle</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${data.centerName}</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="font-size:16px;color:#333;">Bonjour <strong>${data.clientName}</strong>,</p>
        <p style="color:#555;line-height:1.6;">Nous vous informons que notre centre sera fermé :</p>
        <div style="background:#eef2ff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #6366f1;">
          <p style="font-size:18px;font-weight:600;color:#4338ca;margin:0;">${data.holidayName}</p>
          <p style="color:#555;margin:8px 0 0;">📅 ${data.date}${data.endDate ? ` — ${data.endDate}` : ''}</p>
        </div>
        <p style="color:#555;font-size:14px;">Si vous avez une réservation pendant cette période, elle sera automatiquement réorganisée.</p>
      </div>
      <div style="background:#f8f9fa;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} ${data.centerName} — Propulsé par AgendaCT</p>
      </div>
    </div>
  </div>
</body>
</html>`;

        return this.sendEmail(to, `Fermeture : ${data.holidayName} — ${data.centerName}`, html);
    }
}
