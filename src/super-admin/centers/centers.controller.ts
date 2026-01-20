import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminCentersService } from './centers.service';
import { Roles } from '../../auth/decorators';
import { RolesGuard } from '../../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('super-admin/centers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminCentersController {
    constructor(private centersService: SuperAdminCentersService) { }

    @Get()
    async findAll(
        @Query('status') status?: 'active' | 'inactive' | 'all',
        @Query('search') search?: string,
        @Query('city') city?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.centersService.findAll({ status, search, city, page, limit });
    }

    @Get('stats')
    async getStats() {
        return this.centersService.getStats();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.centersService.findOne(id);
    }

    @Post()
    async create(@Body() dto: any) {
        return this.centersService.create(dto);
    }

    @Patch(':id/toggle')
    async toggle(@Param('id') id: string) {
        return this.centersService.toggleActive(id);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        await this.centersService.remove(id);
        return { message: 'تم حذف المركز بنجاح' };
    }
}
