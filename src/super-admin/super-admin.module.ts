import { Module } from '@nestjs/common';
import { SuperAdminCentersModule } from './centers/centers.module';
import { SuperAdminStatsModule } from './stats/stats.module';

@Module({
    imports: [SuperAdminCentersModule, SuperAdminStatsModule],
    exports: [SuperAdminCentersModule, SuperAdminStatsModule],
})
export class SuperAdminModule { }
