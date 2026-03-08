import { Controller, Get, Patch, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { UpdateCTCenterSettingsDto, UpdateOpeningHoursDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('settings')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
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

    @Patch('business-rules')
    async updateBusinessRules(@CurrentUser() user: any, @Body() rules: Record<string, boolean>) {
        return this.settingsService.updateBusinessRules(user.ctCenterId, rules);
    }

    @Get('payment-methods')
    async getPaymentMethods(@CurrentUser() user: any) {
        return this.settingsService.getPaymentMethods(user.ctCenterId);
    }

    @Patch('payment-methods')
    async updatePaymentMethods(@CurrentUser() user: any, @Body() methods: Record<string, any>) {
        return this.settingsService.updatePaymentMethods(user.ctCenterId, methods);
    }

    @Get('landing-page')
    async getLandingPage(@CurrentUser() user: any) {
        return this.settingsService.getLandingPage(user.ctCenterId);
    }

    @Patch('landing-page')
    async updateLandingPage(@CurrentUser() user: any, @Body() data: any) {
        return this.settingsService.updateLandingPage(user.ctCenterId, data);
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

    // ─── Regulatory Compliance ────────────────────────────────────────────────
    @Get('regulatory-compliance')
    async getRegulatoryCompliance(@CurrentUser() user: any) {
        return this.settingsService.getRegulatoryCompliance(user.ctCenterId);
    }

    @Patch('regulatory-compliance')
    async updateRegulatoryCompliance(@CurrentUser() user: any, @Body() data: any) {
        return this.settingsService.updateRegulatoryCompliance(user.ctCenterId, data);
    }

    // ─── Document Types ───────────────────────────────────────────────────────
    @Get('document-types')
    async getDocumentTypes(@CurrentUser() user: any) {
        return this.settingsService.getDocumentTypes(user.ctCenterId);
    }

    @Post('document-types')
    async createDocumentType(@CurrentUser() user: any, @Body() data: any) {
        return this.settingsService.createDocumentType(user.ctCenterId, data);
    }

    @Patch('document-types/:id')
    async updateDocumentType(@CurrentUser() user: any, @Param('id') id: string, @Body() data: any) {
        return this.settingsService.updateDocumentType(user.ctCenterId, id, data);
    }

    @Delete('document-types/:id')
    async deleteDocumentType(@CurrentUser() user: any, @Param('id') id: string) {
        return this.settingsService.deleteDocumentType(user.ctCenterId, id);
    }

    // ─── Loyalty Card ─────────────────────────────────────────────────────────
    @Get('loyalty-card')
    async getLoyaltyCard(@CurrentUser() user: any) {
        return this.settingsService.getLoyaltyCard(user.ctCenterId);
    }

    @Patch('loyalty-card')
    async updateLoyaltyCard(@CurrentUser() user: any, @Body() data: any) {
        return this.settingsService.updateLoyaltyCard(user.ctCenterId, data);
    }

    // ─── Menu Settings ────────────────────────────────────────────────────────
    @Get('menu')
    async getMenuSettings(@CurrentUser() user: any) {
        return this.settingsService.getMenuSettings(user.ctCenterId);
    }

    @Patch('menu')
    async updateMenuSettings(@CurrentUser() user: any, @Body() data: any) {
        return this.settingsService.updateMenuSettings(user.ctCenterId, data);
    }
}
