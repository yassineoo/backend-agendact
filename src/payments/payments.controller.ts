import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, PaymentFilterDto, ProcessRefundDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('payments')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
@Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
export class PaymentsController {
    constructor(private paymentsService: PaymentsService) { }

    @Get()
    async findAll(@CurrentUser() user: any, @Query() filter: PaymentFilterDto) {
        return this.paymentsService.findAll(user.ctCenterId, filter);
    }

    @Get('stats')
    async getStats(@CurrentUser() user: any, @Query('period') period?: 'day' | 'week' | 'month' | 'year') {
        return this.paymentsService.getStats(user.ctCenterId, period || 'month');
    }

    @Get(':id')
    async findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.paymentsService.findOne(user.ctCenterId, id);
    }

    @Post()
    async create(@CurrentUser() user: any, @Body() dto: CreatePaymentDto) {
        return this.paymentsService.create(user.ctCenterId, dto, user.id);
    }

    @Patch(':id/paid')
    async markAsPaid(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto?: { transactionId?: string },
    ) {
        return this.paymentsService.markAsPaid(user.ctCenterId, id, dto?.transactionId);
    }

    @Post(':id/refund')
    @Roles(UserRole.CT_ADMIN)
    async refund(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ProcessRefundDto) {
        return this.paymentsService.processRefund(user.ctCenterId, id, dto);
    }
}
