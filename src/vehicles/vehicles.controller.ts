import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('vehicles')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
@Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
export class VehiclesController {
    constructor(private vehiclesService: VehiclesService) { }

    @Get()
    async findAll(@CurrentUser() user: any, @Query('clientId') clientId?: string) {
        return this.vehiclesService.findAll(user.ctCenterId, clientId);
    }

    @Get(':id')
    async findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.vehiclesService.findOne(user.ctCenterId, id);
    }

    @Get(':id/history')
    async getHistory(@CurrentUser() user: any, @Param('id') id: string) {
        return this.vehiclesService.getHistory(user.ctCenterId, id);
    }

    @Post()
    async create(@CurrentUser() user: any, @Body() dto: CreateVehicleDto) {
        return this.vehiclesService.create(user.ctCenterId, dto);
    }

    @Patch(':id')
    async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateVehicleDto) {
        return this.vehiclesService.update(user.ctCenterId, id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.CT_ADMIN)
    async remove(@CurrentUser() user: any, @Param('id') id: string) {
        await this.vehiclesService.remove(user.ctCenterId, id);
        return { message: 'تم حذف المركبة بنجاح' };
    }
}
