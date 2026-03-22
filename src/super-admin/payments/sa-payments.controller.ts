import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards';
import { Roles } from '../../auth/decorators';
import { UserRole } from '@prisma/client';
import { SuperAdminPaymentsService } from './sa-payments.service';

@Controller('super-admin/payments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminPaymentsController {
    constructor(private paymentsService: SuperAdminPaymentsService) { }

    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('period') period?: string,
    ) {
        return this.paymentsService.findAll({
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            status,
            period,
        });
    }

    @Get('stats')
    getStats() {
        return this.paymentsService.getStats();
    }
}
