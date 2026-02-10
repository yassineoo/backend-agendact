import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, UpdatePromotionDto, ValidatePromoCodeDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('promotions')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
@Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
export class PromotionsController {
    constructor(private promotionsService: PromotionsService) { }

    @Get()
    async findAll(@CurrentUser() user: any, @Query('includeInactive') includeInactive?: boolean) {
        return this.promotionsService.findAll(user.ctCenterId, includeInactive);
    }

    @Get('stats')
    async getStats(@CurrentUser() user: any) {
        return this.promotionsService.getStats(user.ctCenterId);
    }

    @Get(':id')
    async findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.promotionsService.findOne(user.ctCenterId, id);
    }

    @Post()
    @Roles(UserRole.CT_ADMIN)
    async create(@CurrentUser() user: any, @Body() dto: CreatePromotionDto) {
        return this.promotionsService.create(user.ctCenterId, dto);
    }

    @Post('validate')
    async validate(@CurrentUser() user: any, @Body() dto: ValidatePromoCodeDto) {
        return this.promotionsService.validateCode(user.ctCenterId, dto);
    }

    @Patch(':id')
    @Roles(UserRole.CT_ADMIN)
    async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdatePromotionDto) {
        return this.promotionsService.update(user.ctCenterId, id, dto);
    }

    @Patch(':id/toggle')
    @Roles(UserRole.CT_ADMIN)
    async toggle(@CurrentUser() user: any, @Param('id') id: string) {
        return this.promotionsService.toggleActive(user.ctCenterId, id);
    }

    @Delete(':id')
    @Roles(UserRole.CT_ADMIN)
    async remove(@CurrentUser() user: any, @Param('id') id: string) {
        await this.promotionsService.remove(user.ctCenterId, id);
        return { message: 'تم حذف العرض بنجاح' };
    }
}
