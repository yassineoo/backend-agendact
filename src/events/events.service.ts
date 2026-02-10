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

export interface HolidayCreatedEvent {
    holidayId: string;
    ctCenterId: string;
    name: string;
    date: Date;
    endDate?: Date;
}

export interface PromotionCreatedEvent {
    promotionId: string;
    ctCenterId: string;
    name: string;
    code?: string;
    discountType: string;
    discountValue: number;
    startDate: Date;
    endDate: Date;
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
                    'Nouvelle réservation',
                    `Une nouvelle réservation a été créée pour le ${new Date(event.date).toLocaleDateString('fr-FR')}`,
                    'RESERVATION',
                    { reservationId: event.reservationId },
                );
            }

            // 2. Get client info for SMS/Email
            const client = await this.prisma.client.findUnique({
                where: { id: event.clientId },
            });

            const center = await this.prisma.cTCenter.findUnique({ where: { id: event.ctCenterId } });

            if (client?.phone) {
                await this.smsService.sendSms(
                    client.phone,
                    `Confirmation de votre réservation au ${center?.name || 'centre'} le ${new Date(event.date).toLocaleDateString('fr-FR')} à ${event.startTime}. Véhicule: ${event.vehicleInfo}`,
                    event.ctCenterId,
                );
            }

            if (client?.email) {
                await this.emailService.sendReservationConfirmation(client.email, {
                    clientName: `${client.firstName} ${client.lastName}`,
                    date: new Date(event.date).toLocaleDateString('fr-FR'),
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
            const client = await this.prisma.client.findUnique({ where: { id: event.clientId } });
            const user = client ? await this.prisma.user.findFirst({ where: { email: client.email } }) : null;
            const center = await this.prisma.cTCenter.findUnique({ where: { id: event.ctCenterId } });
            const reservation = await this.prisma.reservation.findUnique({ where: { id: event.reservationId } });

            const statusMessages: Record<string, string> = {
                CONFIRMED: 'Votre réservation a été confirmée',
                IN_PROGRESS: 'Le contrôle technique de votre véhicule a commencé',
                COMPLETED: 'Le contrôle technique de votre véhicule est terminé',
                CANCELLED: 'Votre réservation a été annulée',
            };
            const message = statusMessages[event.newStatus] || `Statut mis à jour : ${event.newStatus}`;

            // In-app notification
            if (user) {
                await this.notificationsService.create(user.id, 'Mise à jour de réservation', message, 'RESERVATION', {
                    reservationId: event.reservationId,
                    status: event.newStatus,
                });
            }

            // Email notification
            if (client?.email) {
                await this.emailService.sendStatusUpdate(client.email, {
                    clientName: `${client.firstName} ${client.lastName}`,
                    centerName: center?.name || 'AgendaCT',
                    status: event.newStatus,
                    statusMessage: message,
                    bookingCode: reservation?.bookingCode || undefined,
                });
            }

            // SMS for key status changes
            if (client?.phone && ['CONFIRMED', 'COMPLETED'].includes(event.newStatus)) {
                await this.smsService.sendSms(
                    client.phone,
                    `${message}. ${center?.name || ''}`,
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
            const center = await this.prisma.cTCenter.findUnique({
                where: { id: event.ctCenterId },
                include: { owner: true },
            });

            // Notify center admin
            if (center?.owner) {
                await this.notificationsService.create(
                    center.owner.id,
                    'Nouveau paiement',
                    `Paiement reçu : ${event.amount} ${center.currency}`,
                    'PAYMENT',
                    { paymentId: event.paymentId },
                );
            }

            // Send payment receipt to client
            const client = await this.prisma.client.findUnique({ where: { id: event.clientId } });
            if (client?.email) {
                await this.emailService.sendPaymentReceipt(client.email, {
                    clientName: `${client.firstName} ${client.lastName}`,
                    centerName: center?.name || 'AgendaCT',
                    amount: event.amount,
                    currency: center?.currency || 'EUR',
                    date: new Date().toLocaleDateString('fr-FR'),
                });
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

    @OnEvent('holiday.created')
    async handleHolidayCreated(event: HolidayCreatedEvent) {
        this.logger.log(`Handling holiday.created: ${event.holidayId} (${event.name})`);

        try {
            const center = await this.prisma.cTCenter.findUnique({ where: { id: event.ctCenterId } });
            if (!center) return;

            const holidayStart = new Date(event.date);
            holidayStart.setHours(0, 0, 0, 0);
            const holidayEnd = event.endDate ? new Date(event.endDate) : new Date(event.date);
            holidayEnd.setHours(23, 59, 59, 999);

            // 1. Find reservations that overlap with the holiday period
            const affectedReservations = await this.prisma.reservation.findMany({
                where: {
                    ctCenterId: event.ctCenterId,
                    date: { gte: holidayStart, lte: holidayEnd },
                    status: { in: ['PENDING', 'CONFIRMED'] },
                    deletedAt: null,
                },
                include: {
                    client: true,
                    employee: true,
                },
            });

            this.logger.log(`Found ${affectedReservations.length} reservations affected by holiday "${event.name}"`);

            // 2. Cancel affected reservations and notify clients
            for (const reservation of affectedReservations) {
                await this.prisma.reservation.update({
                    where: { id: reservation.id },
                    data: { status: 'CANCELLED', notes: `Annulé automatiquement — ${event.name}` },
                });

                // Notify assigned employee
                if (reservation.employeeId) {
                    await this.notificationsService.create(
                        reservation.employeeId,
                        'Réservation annulée (jour férié)',
                        `La réservation ${reservation.bookingCode || reservation.id.slice(0, 8)} a été annulée en raison de : ${event.name}`,
                        'RESERVATION',
                        { reservationId: reservation.id },
                    );
                }

                // Contact the client
                const client = reservation.client;
                if (client?.email) {
                    await this.emailService.sendHolidayNotification(client.email, {
                        clientName: `${client.firstName} ${client.lastName}`,
                        centerName: center.name,
                        holidayName: event.name,
                        date: holidayStart.toLocaleDateString('fr-FR'),
                        endDate: event.endDate ? holidayEnd.toLocaleDateString('fr-FR') : undefined,
                    });
                }

                if (client?.phone) {
                    await this.smsService.sendSms(
                        client.phone,
                        `Votre réservation au ${center.name} a été annulée en raison de : ${event.name}. Merci de nous contacter pour reprogrammer.`,
                        event.ctCenterId,
                    );
                }
            }

            // 3. Notify center owner
            if (center.ownerId) {
                await this.notificationsService.create(
                    center.ownerId,
                    'Jour férié ajouté',
                    `${event.name} (${holidayStart.toLocaleDateString('fr-FR')}). ${affectedReservations.length} réservation(s) annulée(s).`,
                    'SYSTEM',
                    { holidayId: event.holidayId, cancelledCount: affectedReservations.length },
                );
            }
        } catch (error: any) {
            this.logger.error(`Error handling holiday.created: ${error.message}`);
        }
    }

    @OnEvent('promotion.created')
    async handlePromotionCreated(event: PromotionCreatedEvent) {
        this.logger.log(`Handling promotion.created: ${event.promotionId} (${event.name})`);

        try {
            const center = await this.prisma.cTCenter.findUnique({ where: { id: event.ctCenterId } });
            if (!center) return;

            // Format discount display
            const discountDisplay = event.discountType === 'PERCENTAGE'
                ? `-${event.discountValue}%`
                : `-${event.discountValue}€`;

            // 1. Notify center owner
            if (center.ownerId) {
                await this.notificationsService.create(
                    center.ownerId,
                    'Nouvelle promotion créée',
                    `"${event.name}" (${discountDisplay}) — du ${new Date(event.startDate).toLocaleDateString('fr-FR')} au ${new Date(event.endDate).toLocaleDateString('fr-FR')}`,
                    'SYSTEM',
                    { promotionId: event.promotionId },
                );
            }

            // 2. Get recent/active clients of this center to notify
            const recentClients = await this.prisma.client.findMany({
                where: {
                    ctCenterId: event.ctCenterId,
                    deletedAt: null,
                },
                take: 200,
                orderBy: { updatedAt: 'desc' },
            });

            this.logger.log(`Sending promo notifications to ${recentClients.length} clients`);

            // 3. Send email and SMS to clients (batch, with rate limiting)
            for (const client of recentClients) {
                if (client.email) {
                    await this.emailService.sendPromotionNotification(client.email, {
                        clientName: `${client.firstName} ${client.lastName}`,
                        centerName: center.name,
                        promoName: event.name,
                        promoCode: event.code || undefined,
                        discountValue: discountDisplay,
                        startDate: new Date(event.startDate).toLocaleDateString('fr-FR'),
                        endDate: new Date(event.endDate).toLocaleDateString('fr-FR'),
                    });
                }

                if (client.phone) {
                    await this.smsService.sendSms(
                        client.phone,
                        `🎉 ${center.name} : ${event.name} ${discountDisplay}${event.code ? ` | Code: ${event.code}` : ''}. Valable jusqu'au ${new Date(event.endDate).toLocaleDateString('fr-FR')}`,
                        event.ctCenterId,
                    );
                }
            }
        } catch (error: any) {
            this.logger.error(`Error handling promotion.created: ${error.message}`);
        }
    }
}
