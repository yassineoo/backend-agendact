import { Module } from '@nestjs/common';
import { SuperAdminCentersController } from './centers.controller';
import { SuperAdminCentersService } from './centers.service';

@Module({
    controllers: [SuperAdminCentersController],
    providers: [SuperAdminCentersService],
    exports: [SuperAdminCentersService],
})
export class SuperAdminCentersModule { }
