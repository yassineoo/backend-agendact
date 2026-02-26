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
import { PrestationsService } from './prestations.service';
import { CreatePrestationDto, UpdatePrestationDto, ReorderPrestationsDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { UserRole, VehicleClass } from '@prisma/client';

@Controller('prestations')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
export class PrestationsController {
    constructor(private prestationsService: PrestationsService) { }

    @Get()
    @Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
    async findAll(
        @CurrentUser() user: any,
        @Query('includeInactive') includeInactive?: boolean,
        @Query('vehicleClass') vehicleClass?: VehicleClass,
    ) {
        return this.prestationsService.findAll(user.ctCenterId, includeInactive, vehicleClass);
    }

    @Get(':id')
    @Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
    async findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.prestationsService.findOne(user.ctCenterId, id);
    }

    @Post()
    @Roles(UserRole.CT_ADMIN)
    async create(@CurrentUser() user: any, @Body() dto: CreatePrestationDto) {
        return this.prestationsService.create(user.ctCenterId, dto);
    }

    @Patch('reorder')
    @Roles(UserRole.CT_ADMIN)
    async reorder(@CurrentUser() user: any, @Body() dto: ReorderPrestationsDto) {
        return this.prestationsService.reorder(user.ctCenterId, dto.prestations);
    }

    @Patch(':id')
    @Roles(UserRole.CT_ADMIN)
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdatePrestationDto,
    ) {
        return this.prestationsService.update(user.ctCenterId, id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.CT_ADMIN)
    async remove(@CurrentUser() user: any, @Param('id') id: string) {
        await this.prestationsService.remove(user.ctCenterId, id);
        return { message: 'Prestation supprimée avec succès' };
    }

    @Patch(':id/toggle')
    @Roles(UserRole.CT_ADMIN)
    async toggle(@CurrentUser() user: any, @Param('id') id: string) {
        return this.prestationsService.toggleActive(user.ctCenterId, id);
    }
}
