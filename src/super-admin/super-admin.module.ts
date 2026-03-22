import { Module } from '@nestjs/common';
import { SuperAdminCentersModule } from './centers/centers.module';
import { SuperAdminStatsModule } from './stats/stats.module';
import { SuperAdminSubscriptionsModule } from './subscriptions/subscriptions.module';
import { SuperAdminPlansModule } from './plans/plans.module';
import { SuperAdminUsersModule } from './users/users.module';
import { SuperAdminAuditModule } from './audit/audit.module';
import { SystemSettingsModule } from './settings/system-settings.module';
import { SuperAdminPaymentsModule } from './payments/sa-payments.module';
import { SuperAdminReservationsModule } from './reservations/sa-reservations.module';

@Module({
    imports: [
        SuperAdminCentersModule,
        SuperAdminStatsModule,
        SuperAdminSubscriptionsModule,
        SuperAdminPlansModule,
        SuperAdminUsersModule,
        SuperAdminAuditModule,
        SystemSettingsModule,
        SuperAdminPaymentsModule,
        SuperAdminReservationsModule,
    ],
    exports: [
        SuperAdminCentersModule,
        SuperAdminStatsModule,
        SuperAdminSubscriptionsModule,
        SuperAdminPlansModule,
        SuperAdminUsersModule,
        SuperAdminAuditModule,
        SystemSettingsModule,
        SuperAdminPaymentsModule,
        SuperAdminReservationsModule,
    ],
})
export class SuperAdminModule { }
