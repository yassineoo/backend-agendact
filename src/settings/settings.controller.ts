import { Controller, Get, Patch, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { UpdateCTCenterSettingsDto, UpdateOpeningHoursDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.CT_ADMIN)
export class SettingsController {
    constructor(private settingsService: SettingsService) { }

    @Get()
    async getSettings(@CurrentUser() user: any) {
        return this.settingsService.getCTCenterSettings(user.ctCenterId);
    }

    @Patch()
    async updateSettings(@CurrentUser() user: any, @Body() dto: UpdateCTCenterSettingsDto) {
        return this.settingsService.updateCTCenterSettings(user.ctCenterId, dto);
    }

    @Patch('opening-hours')
    async updateOpeningHours(@CurrentUser() user: any, @Body() dto: UpdateOpeningHoursDto) {
        return this.settingsService.updateOpeningHours(user.ctCenterId, dto);
    }

    @Get('payment-methods')
    async getPaymentMethods(@CurrentUser() user: any) {
        return this.settingsService.getPaymentMethods(user.ctCenterId);
    }

    @Patch('payment-methods')
    async updatePaymentMethods(@CurrentUser() user: any, @Body() methods: Record<string, any>) {
        return this.settingsService.updatePaymentMethods(user.ctCenterId, methods);
    }

    @Get('trash')
    async getTrash(@CurrentUser() user: any) {
        return this.settingsService.getTrash(user.ctCenterId);
    }

    @Post('trash/:type/:id/restore')
    async restore(@CurrentUser() user: any, @Param('type') type: string, @Param('id') id: string) {
        return this.settingsService.restoreFromTrash(user.ctCenterId, type, id);
    }

    @Delete('trash/:type/:id')
    async permanentDelete(@CurrentUser() user: any, @Param('type') type: string, @Param('id') id: string) {
        return this.settingsService.permanentDelete(user.ctCenterId, type, id);
    }

    @Delete('trash')
    async emptyTrash(@CurrentUser() user: any) {
        return this.settingsService.emptyTrash(user.ctCenterId);
    }
}
