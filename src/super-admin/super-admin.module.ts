import { Module } from '@nestjs/common';
import { SuperAdminCentersModule } from './centers/centers.module';
import { SuperAdminStatsModule } from './stats/stats.module';
import { SuperAdminSubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
    imports: [SuperAdminCentersModule, SuperAdminStatsModule, SuperAdminSubscriptionsModule],
    exports: [SuperAdminCentersModule, SuperAdminStatsModule, SuperAdminSubscriptionsModule],
})
export class SuperAdminModule { }
