import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from '../sms/sms.service';
import { EmailService } from '../email/email.service';

// Event payload interfaces
export interface ReservationCreatedEvent {
    reservationId: string;
    ctCenterId: string;
    clientId: string;
    employeeId?: string;
    date: Date;
    startTime: string;
    vehicleInfo: string;
}

export interface ReservationStatusChangedEvent {
    reservationId: string;
    ctCenterId: string;
    clientId: string;
    employeeId?: string;
    oldStatus: string;
    newStatus: string;
}

export interface PaymentCompletedEvent {
    paymentId: string;
    ctCenterId: string;
    reservationId?: string;
    amount: number;
    clientId: string;
}

@Injectable()
export class EventsService {
    private readonly logger = new Logger(EventsService.name);

    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
        private smsService: SmsService,
        private emailService: EmailService,
    ) { }

    @OnEvent('reservation.created')
    async handleReservationCreated(event: ReservationCreatedEvent) {
        this.logger.log(`Handling reservation.created: ${event.reservationId}`);

        try {
            // 1. Notify the assigned employee
            if (event.employeeId) {
                await this.notificationsService.create(
                    event.employeeId,
                    'حجز جديد',
                    `تم إنشاء حجز جديد ليوم ${event.date.toLocaleDateString('ar')}`,
                    'RESERVATION',
                    { reservationId: event.reservationId },
                );
            }

            // 2. Get client info for SMS/Email
            const client = await this.prisma.client.findUnique({
                where: { id: event.clientId },
            });

            if (client?.phone) {
                const center = await this.prisma.cTCenter.findUnique({ where: { id: event.ctCenterId } });
                await this.smsService.sendSms(
                    client.phone,
                    `تأكيد حجزكم في ${center?.name || 'المركز'} ليوم ${event.date.toLocaleDateString('ar')} الساعة ${event.startTime}. مركبة: ${event.vehicleInfo}`,
                    event.ctCenterId,
                );
            }

            if (client?.email) {
                const center = await this.prisma.cTCenter.findUnique({ where: { id: event.ctCenterId } });
                await this.emailService.sendReservationConfirmation(client.email, {
                    clientName: `${client.firstName} ${client.lastName}`,
                    date: event.date.toLocaleDateString('ar'),
                    time: event.startTime,
                    vehicleInfo: event.vehicleInfo,
                    centerName: center?.name || 'AgendaCT',
                });
            }
        } catch (error: any) {
            this.logger.error(`Error handling reservation.created: ${error.message}`);
        }
    }

    @OnEvent('reservation.status_changed')
    async handleReservationStatusChanged(event: ReservationStatusChangedEvent) {
        this.logger.log(`Handling reservation.status_changed: ${event.reservationId} ${event.oldStatus} -> ${event.newStatus}`);

        try {
            // Notify the client about status change
            const client = await this.prisma.client.findUnique({ where: { id: event.clientId } });
            const user = client ? await this.prisma.user.findFirst({ where: { email: client.email } }) : null;

            if (user) {
                const statusMessages: Record<string, string> = {
                    CONFIRMED: 'تم تأكيد حجزكم',
                    IN_PROGRESS: 'بدأ الفحص التقني لمركبتكم',
                    COMPLETED: 'اكتمل الفحص التقني لمركبتكم',
                    CANCELLED: 'تم إلغاء حجزكم',
                };

                const message = statusMessages[event.newStatus] || `تم تحديث حالة حجزكم إلى ${event.newStatus}`;
                await this.notificationsService.create(user.id, 'تحديث الحجز', message, 'RESERVATION', {
                    reservationId: event.reservationId,
                    status: event.newStatus,
                });
            }

            // SMS notification for CONFIRMED and COMPLETED
            if (client?.phone && ['CONFIRMED', 'COMPLETED'].includes(event.newStatus)) {
                const center = await this.prisma.cTCenter.findUnique({ where: { id: event.ctCenterId } });
                const statusText = event.newStatus === 'CONFIRMED' ? 'تم تأكيد حجزكم' : 'اكتمل الفحص التقني لمركبتكم';
                await this.smsService.sendSms(
                    client.phone,
                    `${statusText} في ${center?.name || 'المركز'}.`,
                    event.ctCenterId,
                );
            }
        } catch (error: any) {
            this.logger.error(`Error handling reservation.status_changed: ${error.message}`);
        }
    }

    @OnEvent('payment.completed')
    async handlePaymentCompleted(event: PaymentCompletedEvent) {
        this.logger.log(`Handling payment.completed: ${event.paymentId}`);

        try {
            // Notify center admin
            const center = await this.prisma.cTCenter.findUnique({
                where: { id: event.ctCenterId },
                include: { owner: true },
            });

            if (center?.owner) {
                await this.notificationsService.create(
                    center.owner.id,
                    'دفعة جديدة',
                    `تم استلام دفعة بقيمة ${event.amount} ${center.currency}`,
                    'PAYMENT',
                    { paymentId: event.paymentId },
                );
            }

            // Update reservation status if linked
            if (event.reservationId) {
                await this.prisma.reservation.update({
                    where: { id: event.reservationId },
                    data: { status: 'CONFIRMED' },
                });
            }
        } catch (error: any) {
            this.logger.error(`Error handling payment.completed: ${error.message}`);
        }
    }
}
