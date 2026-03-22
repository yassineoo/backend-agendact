import { Module } from '@nestjs/common';
import { SuperAdminPaymentsController } from './sa-payments.controller';
import { SuperAdminPaymentsService } from './sa-payments.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SuperAdminPaymentsController],
    providers: [SuperAdminPaymentsService],
    exports: [SuperAdminPaymentsService],
})
export class SuperAdminPaymentsModule { }
