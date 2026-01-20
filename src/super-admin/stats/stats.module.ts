import { Module } from '@nestjs/common';
import { SuperAdminStatsController } from './stats.controller';
import { SuperAdminStatsService } from './stats.service';

@Module({
    controllers: [SuperAdminStatsController],
    providers: [SuperAdminStatsService],
    exports: [SuperAdminStatsService],
})
export class SuperAdminStatsModule { }
