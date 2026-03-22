import { Module } from '@nestjs/common';
import { SuperAdminReservationsController } from './sa-reservations.controller';
import { SuperAdminReservationsService } from './sa-reservations.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SuperAdminReservationsController],
    providers: [SuperAdminReservationsService],
    exports: [SuperAdminReservationsService],
})
export class SuperAdminReservationsModule { }
