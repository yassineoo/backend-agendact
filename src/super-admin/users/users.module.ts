import { Module } from '@nestjs/common';
import { SuperAdminUsersService } from './users.service';
import { SuperAdminUsersController } from './users.controller';

@Module({
    controllers: [SuperAdminUsersController],
    providers: [SuperAdminUsersService],
})
export class SuperAdminUsersModule { }
