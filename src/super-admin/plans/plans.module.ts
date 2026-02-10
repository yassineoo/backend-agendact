import { Module } from '@nestjs/common';
import { SuperAdminPlansService } from './plans.service';
import { SuperAdminPlansController } from './plans.controller';

@Module({
    controllers: [SuperAdminPlansController],
    providers: [SuperAdminPlansService],
})
export class SuperAdminPlansModule { }
