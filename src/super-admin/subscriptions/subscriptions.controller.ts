import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminSubscriptionsService } from './subscriptions.service';
import { Roles } from '../../auth/decorators';
import { RolesGuard } from '../../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('api/super-admin/subscriptions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminSubscriptionsController {
    constructor(private subscriptionsService: SuperAdminSubscriptionsService) { }

    @Get()
    async findAll(
        @Query('status') status?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.subscriptionsService.findAll({ status, page, limit });
    }

    @Get('stats')
    async getStats() {
        return this.subscriptionsService.getStats();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.subscriptionsService.findOne(id);
    }

    @Post()
    async create(@Body() dto: any) {
        return this.subscriptionsService.create(dto);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: any) {
        return this.subscriptionsService.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        await this.subscriptionsService.remove(id);
        return { message: 'Subscription deleted successfully' };
    }
}
