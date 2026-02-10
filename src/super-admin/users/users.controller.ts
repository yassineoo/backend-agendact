import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards';
import { Roles } from '../../auth/decorators';
import { UserRole } from '@prisma/client';
import { SuperAdminUsersService } from './users.service';

@Controller('super-admin/users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminUsersController {
    constructor(private usersService: SuperAdminUsersService) { }

    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('role') role?: string,
        @Query('search') search?: string,
        @Query('ctCenterId') ctCenterId?: string,
    ) {
        return this.usersService.findAll({
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            role,
            search,
            ctCenterId,
        });
    }

    @Get(':id')
    findById(@Param('id') id: string) {
        return this.usersService.findById(id);
    }

    @Patch(':id/toggle-active')
    toggleActive(@Param('id') id: string) {
        return this.usersService.toggleActive(id);
    }

    @Patch(':id/role')
    updateRole(@Param('id') id: string, @Body() dto: { role: UserRole }) {
        return this.usersService.updateRole(id, dto.role);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.usersService.delete(id);
    }
}
