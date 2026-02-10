import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, ClientFilterDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('clients')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
@Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
export class ClientsController {
    constructor(private clientsService: ClientsService) { }

    @Get()
    async findAll(@CurrentUser() user: any, @Query() filter: ClientFilterDto) {
        return this.clientsService.findAll(user.ctCenterId, filter);
    }

    @Get(':id')
    async findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.clientsService.findOne(user.ctCenterId, id);
    }

    @Post()
    async create(@CurrentUser() user: any, @Body() dto: CreateClientDto) {
        return this.clientsService.create(user.ctCenterId, dto);
    }

    @Patch(':id')
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdateClientDto,
    ) {
        return this.clientsService.update(user.ctCenterId, id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.CT_ADMIN)
    async remove(@CurrentUser() user: any, @Param('id') id: string) {
        await this.clientsService.remove(user.ctCenterId, id);
        return { message: 'تم حذف العميل بنجاح' };
    }

    @Get(':id/vehicles')
    async getVehicles(@CurrentUser() user: any, @Param('id') id: string) {
        return this.clientsService.getVehicles(user.ctCenterId, id);
    }

    @Post(':id/loyalty')
    @Roles(UserRole.CT_ADMIN)
    async addLoyaltyPoints(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: { points: number },
    ) {
        return this.clientsService.addLoyaltyPoints(user.ctCenterId, id, dto.points);
    }
}
