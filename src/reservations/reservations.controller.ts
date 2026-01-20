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
import { ReservationsService } from './reservations.service';
import { CreateReservationDto, UpdateReservationDto, UpdateResultDto, ReservationFilterDto, QuickReservationDto } from './dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/guards';
import { UserRole } from '@prisma/client';

@Controller('reservations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.CT_ADMIN, UserRole.EMPLOYEE)
export class ReservationsController {
    constructor(private reservationsService: ReservationsService) { }

    @Get()
    async findAll(@CurrentUser() user: any, @Query() filter: ReservationFilterDto) {
        return this.reservationsService.findAll(user.ctCenterId, filter);
    }

    @Get('day/:date')
    async getDaySchedule(@CurrentUser() user: any, @Param('date') date: string) {
        return this.reservationsService.getDaySchedule(user.ctCenterId, new Date(date));
    }

    @Get('available-slots/:date')
    async getAvailableSlots(
        @CurrentUser() user: any,
        @Param('date') date: string,
        @Query('categoryId') categoryId?: string,
    ) {
        return this.reservationsService.getAvailableSlots(user.ctCenterId, new Date(date), categoryId);
    }

    @Get(':id')
    async findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.reservationsService.findOne(user.ctCenterId, id);
    }

    @Post()
    async create(@CurrentUser() user: any, @Body() dto: CreateReservationDto) {
        return this.reservationsService.create(user.ctCenterId, dto, user.id);
    }

    @Post('quick')
    async quickReservation(@CurrentUser() user: any, @Body() dto: QuickReservationDto) {
        return this.reservationsService.quickReservation(user.ctCenterId, dto, user.id);
    }

    @Patch(':id')
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdateReservationDto,
    ) {
        return this.reservationsService.update(user.ctCenterId, id, dto);
    }

    @Patch(':id/result')
    async updateResult(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdateResultDto,
    ) {
        return this.reservationsService.updateResult(user.ctCenterId, id, dto);
    }

    @Delete(':id')
    async cancel(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Query('reason') reason?: string,
    ) {
        await this.reservationsService.cancel(user.ctCenterId, id, reason);
        return { message: 'تم إلغاء الحجز بنجاح' };
    }

    @Patch(':id/assign')
    async assignEmployee(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: { employeeId: string },
    ) {
        return this.reservationsService.assignEmployee(user.ctCenterId, id, dto.employeeId);
    }
}
