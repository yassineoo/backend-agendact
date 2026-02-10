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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('categories')
@UseGuards(AuthGuard('jwt'), RolesGuard, TenantGuard)
export class CategoriesController {
    constructor(private categoriesService: CategoriesService) { }

    @Get()
    @Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
    async findAll(
        @CurrentUser() user: any,
        @Query('includeInactive') includeInactive?: boolean,
    ) {
        return this.categoriesService.findAll(user.ctCenterId, includeInactive);
    }

    @Get(':id')
    @Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
    async findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.categoriesService.findOne(user.ctCenterId, id);
    }

    @Post()
    @Roles(UserRole.CT_ADMIN)
    async create(@CurrentUser() user: any, @Body() dto: CreateCategoryDto) {
        return this.categoriesService.create(user.ctCenterId, dto);
    }

    @Patch('reorder')
    @Roles(UserRole.CT_ADMIN)
    async reorder(@CurrentUser() user: any, @Body() dto: ReorderCategoriesDto) {
        return this.categoriesService.reorder(user.ctCenterId, dto.categories);
    }

    @Patch(':id')
    @Roles(UserRole.CT_ADMIN)
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdateCategoryDto,
    ) {
        return this.categoriesService.update(user.ctCenterId, id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.CT_ADMIN)
    async remove(@CurrentUser() user: any, @Param('id') id: string) {
        await this.categoriesService.remove(user.ctCenterId, id);
        return { message: 'تم حذف الفئة بنجاح' };
    }

    @Patch(':id/toggle')
    @Roles(UserRole.CT_ADMIN)
    async toggle(@CurrentUser() user: any, @Param('id') id: string) {
        return this.categoriesService.toggleActive(user.ctCenterId, id);
    }

    @Post(':id/duplicate')
    @Roles(UserRole.CT_ADMIN)
    async duplicate(@CurrentUser() user: any, @Param('id') id: string) {
        return this.categoriesService.duplicate(user.ctCenterId, id);
    }
}
