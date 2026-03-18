import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('public/landing')
export class PublicLandingController {
    constructor(private settingsService: SettingsService) { }

    @Get(':slug')
    async getLandingPage(@Param('slug') slug: string) {
        const data = await this.settingsService.getLandingPagePublic(slug);
        if (!data) {
            throw new NotFoundException('Landing page not found for this center');
        }
        return data;
    }
}
