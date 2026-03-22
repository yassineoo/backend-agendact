import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards';
import { Roles } from '../../auth/decorators';
import { UserRole } from '@prisma/client';
import { SuperAdminReservationsService } from './sa-reservations.service';

@Controller('super-admin/reservations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminReservationsController {
    constructor(private reservationsService: SuperAdminReservationsService) { }

    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
    ) {
        return this.reservationsService.findAll({
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            status,
        });
    }

    @Get('stats')
    getStats() {
        return this.reservationsService.getStats();
    }
}
