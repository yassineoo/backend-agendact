import { Module } from '@nestjs/common';
import { SuperAdminSubscriptionsController } from './subscriptions.controller';
import { SuperAdminSubscriptionsService } from './subscriptions.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SuperAdminSubscriptionsController],
    providers: [SuperAdminSubscriptionsService],
    exports: [SuperAdminSubscriptionsService],
})
export class SuperAdminSubscriptionsModule { }
