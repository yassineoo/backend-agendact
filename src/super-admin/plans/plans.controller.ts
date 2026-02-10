import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards';
import { Roles } from '../../auth/decorators';
import { UserRole } from '@prisma/client';
import { SuperAdminPlansService } from './plans.service';

@Controller('super-admin/plans')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminPlansController {
    constructor(private plansService: SuperAdminPlansService) { }

    @Get()
    findAll() {
        return this.plansService.findAll();
    }

    @Get(':id')
    findById(@Param('id') id: string) {
        return this.plansService.findById(id);
    }

    @Post()
    create(@Body() dto: any) {
        return this.plansService.create(dto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: any) {
        return this.plansService.update(id, dto);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.plansService.delete(id);
    }
}
