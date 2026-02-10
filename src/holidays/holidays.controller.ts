import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto, UpdateHolidayDto, HolidayFilterDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('holidays')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
@Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
export class HolidaysController {
    constructor(private holidaysService: HolidaysService) { }

    @Get()
    async findAll(@CurrentUser() user: any, @Query() filter: HolidayFilterDto) {
        return this.holidaysService.findAll(user.ctCenterId, filter);
    }

    @Get('upcoming')
    async getUpcoming(@CurrentUser() user: any, @Query('limit') limit?: number) {
        return this.holidaysService.getUpcoming(user.ctCenterId, limit || 5);
    }

    @Get(':id')
    async findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.holidaysService.findOne(user.ctCenterId, id);
    }

    @Post()
    @Roles(UserRole.CT_ADMIN)
    async create(@CurrentUser() user: any, @Body() dto: CreateHolidayDto) {
        return this.holidaysService.create(user.ctCenterId, dto);
    }

    @Post('import/:year')
    @Roles(UserRole.CT_ADMIN)
    async importPublicHolidays(@CurrentUser() user: any, @Param('year') year: number) {
        return this.holidaysService.importPublicHolidays(user.ctCenterId, Number(year));
    }

    @Patch(':id')
    @Roles(UserRole.CT_ADMIN)
    async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateHolidayDto) {
        return this.holidaysService.update(user.ctCenterId, id, dto);
    }

    @Patch(':id/toggle')
    @Roles(UserRole.CT_ADMIN)
    async toggle(@CurrentUser() user: any, @Param('id') id: string) {
        return this.holidaysService.toggleActive(user.ctCenterId, id);
    }

    @Delete(':id')
    @Roles(UserRole.CT_ADMIN)
    async remove(@CurrentUser() user: any, @Param('id') id: string) {
        await this.holidaysService.remove(user.ctCenterId, id);
        return { message: 'تم حذف العطلة بنجاح' };
    }
}
