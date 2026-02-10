import { Controller, Post, Body, Headers, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StripeService } from './stripe.service';
import { CurrentUser } from '../auth/decorators';
import { TenantGuard } from '../auth/guards';

@Controller('stripe')
export class StripeController {
    constructor(private stripeService: StripeService) { }

    @Post('checkout')
    @UseGuards(AuthGuard('jwt'), TenantGuard)
    async createCheckout(@CurrentUser() user: any, @Body() dto: { planId: string }) {
        return this.stripeService.createCheckoutSession(dto.planId, user.ctCenterId);
    }

    @Post('portal')
    @UseGuards(AuthGuard('jwt'), TenantGuard)
    async createPortal(@CurrentUser() user: any) {
        return this.stripeService.createPortalSession(user.ctCenterId);
    }

    @Post('payment-intent')
    @UseGuards(AuthGuard('jwt'), TenantGuard)
    async createPaymentIntent(
        @CurrentUser() user: any,
        @Body() dto: { amount: number; reservationId?: string },
    ) {
        return this.stripeService.createPaymentIntent(dto.amount, user.ctCenterId, dto.reservationId);
    }

    @Post('webhook')
    async handleWebhook(
        @Req() req: any,
        @Headers('stripe-signature') sig: string,
    ) {
        const rawBody = req.rawBody;
        if (!rawBody) {
            throw new Error('Raw body is required for webhook verification');
        }
        await this.stripeService.handleWebhook(rawBody, sig);
        return { received: true };
    }
}
