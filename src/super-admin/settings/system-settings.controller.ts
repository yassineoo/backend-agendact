import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards';
import { Roles } from '../../auth/decorators';
import { UserRole } from '@prisma/client';
import { SystemSettingsService } from './system-settings.service';

@Controller('super-admin/system-settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SystemSettingsController {
    constructor(private service: SystemSettingsService) { }

    @Get()
    async getAll() {
        return this.service.getAll();
    }

    @Get('platform-info')
    async getPlatformInfo() {
        return this.service.getPlatformInfo();
    }

    @Get(':key')
    async get(@Param('key') key: string) {
        const value = await this.service.get(key);
        return { key, value };
    }

    @Post()
    async set(@Body() body: { key: string; value: any; label?: string }) {
        return this.service.set(body.key, body.value, body.label);
    }

    @Post('bulk')
    async bulkSet(@Body() body: Record<string, any>) {
        return this.service.bulkSet(body);
    }

    @Post('maintenance')
    async setMaintenanceMode(@Body() body: { enabled: boolean }) {
        return this.service.setMaintenanceMode(body.enabled);
    }

    @Delete(':key')
    async delete(@Param('key') key: string) {
        return this.service.delete(key);
    }
}
