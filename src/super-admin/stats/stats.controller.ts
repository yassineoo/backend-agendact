import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminStatsService } from './stats.service';
import { Roles } from '../../auth/decorators';
import { RolesGuard } from '../../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('super-admin/stats')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminStatsController {
    constructor(private statsService: SuperAdminStatsService) { }

    @Get('overview')
    async getOverview() {
        return this.statsService.getOverview();
    }

    @Get('reservations-chart')
    async getReservationsChart(@Query('months') months?: number) {
        return this.statsService.getReservationsChart(months || 6);
    }

    @Get('top-centers')
    async getTopCenters(
        @Query('limit') limit?: number,
        @Query('metric') metric?: 'reservations' | 'revenue',
    ) {
        return this.statsService.getTopCenters(limit || 10, metric || 'reservations');
    }
}
