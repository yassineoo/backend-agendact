import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SmsService } from './sms.service';
import { CurrentUser } from '../auth/decorators';
import { TenantGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '@prisma/client';

@Controller('sms')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
@Roles(UserRole.CT_ADMIN)
export class SmsController {
    constructor(private smsService: SmsService) { }

    @Post('send')
    async send(
        @CurrentUser() user: any,
        @Body() dto: { to: string; message: string },
    ) {
        const sent = await this.smsService.sendSms(dto.to, dto.message, user.ctCenterId);
        return { sent };
    }

    @Get('usage')
    async getUsage(
        @CurrentUser() user: any,
        @Query('month') month?: string,
    ) {
        return this.smsService.getUsage(user.ctCenterId, month);
    }
}
