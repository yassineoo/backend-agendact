import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.CT_ADMIN)
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get()
    async findAll(@CurrentUser() user: any, @Query('includeInactive') includeInactive?: boolean) {
        return this.usersService.findAll(user.ctCenterId, includeInactive);
    }

    @Get('stats')
    async getStats(@CurrentUser() user: any) {
        return this.usersService.getStats(user.ctCenterId);
    }

    @Get(':id')
    async findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.usersService.findOne(user.ctCenterId, id);
    }

    @Post()
    async create(@CurrentUser() user: any, @Body() dto: CreateUserDto) {
        return this.usersService.create(user.ctCenterId, dto);
    }

    @Patch(':id')
    async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.usersService.update(user.ctCenterId, id, dto);
    }

    @Delete(':id')
    async remove(@CurrentUser() user: any, @Param('id') id: string) {
        await this.usersService.remove(user.ctCenterId, id);
        return { message: 'تم حذف الموظف بنجاح' };
    }

    @Patch(':id/toggle')
    async toggle(@CurrentUser() user: any, @Param('id') id: string) {
        return this.usersService.toggleActive(user.ctCenterId, id);
    }

    @Patch(':id/password')
    async resetPassword(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: { password: string }) {
        return this.usersService.resetPassword(user.ctCenterId, id, dto.password);
    }
}
