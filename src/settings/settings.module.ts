import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { PublicLandingController } from './public-landing.controller';
import { SettingsService } from './settings.service';

@Module({
    controllers: [SettingsController, PublicLandingController],
    providers: [SettingsService],
    exports: [SettingsService],
})
export class SettingsModule { }
