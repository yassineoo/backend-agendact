import { Module } from '@nestjs/common';
import { SuperAdminAuditService } from './audit.service';
import { SuperAdminAuditController } from './audit.controller';

@Module({
    controllers: [SuperAdminAuditController],
    providers: [SuperAdminAuditService],
    exports: [SuperAdminAuditService],
})
export class SuperAdminAuditModule { }
