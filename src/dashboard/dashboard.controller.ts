import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
@Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
export class DashboardController {
    constructor(private dashboardService: DashboardService) { }

    @Get('overview')
    async getOverview(@CurrentUser() user: any) {
        return this.dashboardService.getOverview(user.ctCenterId);
    }

    @Get('reservations-chart')
    async getReservationChart(@CurrentUser() user: any, @Query('days') days?: number) {
        return this.dashboardService.getReservationChart(user.ctCenterId, days || 7);
    }

    @Get('reservations-stats')
    async getReservationStats(@CurrentUser() user: any) {
        return this.dashboardService.getReservationStats(user.ctCenterId);
    }

    @Get('revenue-chart')
    async getRevenueChart(@CurrentUser() user: any, @Query('months') months?: number) {
        return this.dashboardService.getRevenueChart(user.ctCenterId, months || 6);
    }

    @Get('upcoming')
    async getUpcoming(@CurrentUser() user: any, @Query('limit') limit?: number) {
        return this.dashboardService.getUpcomingReservations(user.ctCenterId, limit || 5);
    }
}
