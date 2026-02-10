import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
    private stripe: Stripe;
    private readonly logger = new Logger(StripeService.name);

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        this.stripe = new Stripe(secretKey || '');
    }

    async createCheckoutSession(planId: string, ctCenterId: string): Promise<{ url: string }> {
        const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan || !plan.stripePriceId) {
            throw new BadRequestException('Plan not found or not configured in Stripe');
        }

        const center = await this.prisma.cTCenter.findUnique({ where: { id: ctCenterId } });
        if (!center) throw new BadRequestException('Center not found');

        // Get or create Stripe customer
        let customerId = center.stripeCustomerId;
        if (!customerId) {
            const customer = await this.stripe.customers.create({
                email: center.email,
                name: center.name,
                metadata: { ctCenterId },
            });
            customerId = customer.id;
            await this.prisma.cTCenter.update({
                where: { id: ctCenterId },
                data: { stripeCustomerId: customerId },
            });
        }

        const session = await this.stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: plan.stripePriceId, quantity: 1 }],
            success_url: `${this.configService.get('FRONTEND_URL')}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${this.configService.get('FRONTEND_URL')}/subscribe`,
            metadata: { ctCenterId, planId },
        });

        return { url: session.url! };
    }

    async createPortalSession(ctCenterId: string): Promise<{ url: string }> {
        const center = await this.prisma.cTCenter.findUnique({ where: { id: ctCenterId } });
        if (!center?.stripeCustomerId) {
            throw new BadRequestException('No Stripe customer found for this center');
        }

        const session = await this.stripe.billingPortal.sessions.create({
            customer: center.stripeCustomerId,
            return_url: `${this.configService.get('FRONTEND_URL')}/dashboard/settings`,
        });

        return { url: session.url };
    }

    async createPaymentIntent(amount: number, ctCenterId: string, reservationId?: string) {
        const center = await this.prisma.cTCenter.findUnique({ where: { id: ctCenterId } });

        let customerId = center?.stripeCustomerId;
        if (!customerId && center) {
            const customer = await this.stripe.customers.create({
                email: center.email,
                name: center.name,
                metadata: { ctCenterId },
            });
            customerId = customer.id;
            await this.prisma.cTCenter.update({
                where: { id: ctCenterId },
                data: { stripeCustomerId: customerId },
            });
        }

        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe uses cents
            currency: (center as any)?.currency?.toLowerCase() || 'eur',
            customer: customerId || undefined,
            metadata: { ctCenterId, reservationId: reservationId || '' },
        });

        return { clientSecret: paymentIntent.client_secret };
    }

    async handleWebhook(payload: Buffer, sig: string) {
        const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(payload, sig, webhookSecret || '');
        } catch (err: any) {
            this.logger.error(`Webhook signature verification failed: ${err.message}`);
            throw new BadRequestException('Webhook signature verification failed');
        }

        switch (event.type) {
            case 'checkout.session.completed':
                await this.handleCheckoutCompleted(event.data.object as any);
                break;
            case 'invoice.paid':
                await this.handleInvoicePaid(event.data.object as any);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event.data.object as any);
                break;
            case 'invoice.payment_failed':
                await this.handlePaymentFailed(event.data.object as any);
                break;
            default:
                this.logger.log(`Unhandled event type: ${event.type}`);
        }
    }

    private async handleCheckoutCompleted(session: any) {
        const { ctCenterId, planId } = session.metadata || {};
        if (!ctCenterId || !planId) return;

        const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan) return;

        const stripeSubscription: any = await this.stripe.subscriptions.retrieve(session.subscription as string);

        await this.prisma.subscription.create({
            data: {
                ctCenterId,
                planId,
                status: 'ACTIVE',
                startDate: new Date(stripeSubscription.current_period_start * 1000),
                endDate: new Date(stripeSubscription.current_period_end * 1000),
                amount: plan.price,
                stripeSubscriptionId: stripeSubscription.id,
                stripeCurrentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                autoRenew: true,
            },
        });

        this.logger.log(`Subscription activated for center ${ctCenterId}`);
    }

    private async handleInvoicePaid(invoice: any) {
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) return;

        const sub = await this.prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
        });

        if (sub) {
            const stripeSubscription: any = await this.stripe.subscriptions.retrieve(subscriptionId);
            await this.prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    status: 'ACTIVE',
                    endDate: new Date(stripeSubscription.current_period_end * 1000),
                    stripeCurrentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                },
            });
        }
    }

    private async handleSubscriptionDeleted(subscription: any) {
        const sub = await this.prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
        });

        if (sub) {
            await this.prisma.subscription.update({
                where: { id: sub.id },
                data: { status: 'CANCELLED' },
            });
        }
    }

    private async handlePaymentFailed(invoice: any) {
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) return;

        const sub = await this.prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
        });

        if (sub) {
            await this.prisma.subscription.update({
                where: { id: sub.id },
                data: { status: 'INACTIVE' },
            });
        }
    }
}
