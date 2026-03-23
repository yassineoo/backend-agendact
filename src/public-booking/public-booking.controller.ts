import { Controller, Get, Post, Param, Query, Body, BadRequestException } from '@nestjs/common';
import { PublicBookingService } from './public-booking.service';

@Controller('public/booking')
export class PublicBookingController {
    constructor(private bookingService: PublicBookingService) { }

    @Get(':slug/categories')
    async getCategories(@Param('slug') slug: string) {
        return this.bookingService.getCategories(slug);
    }

    @Get(':slug/slots')
    async getSlots(
        @Param('slug') slug: string,
        @Query('date') date: string,
        @Query('categoryId') categoryId?: string,
    ) {
        if (!date) {
            throw new BadRequestException('date query parameter is required (YYYY-MM-DD)');
        }
        return this.bookingService.getSlots(slug, date, categoryId);
    }

    @Get(':slug/promotions')
    async getPromotions(@Param('slug') slug: string) {
        return this.bookingService.getPromotions(slug);
    }

    @Post(':slug/book')
    async book(
        @Param('slug') slug: string,
        @Body() body: {
            clientFirstName: string;
            clientLastName: string;
            clientPhone: string;
            clientEmail?: string;
            vehicleBrand: string;
            vehicleModel: string;
            vehiclePlate: string;
            categoryId: string;
            date: string;
            startTime: string;
            notes?: string;
            promoCode?: string;
        },
    ) {
        if (!body.clientFirstName || !body.clientLastName || !body.clientPhone) {
            throw new BadRequestException('Client first name, last name, and phone are required');
        }
        if (!body.vehiclePlate || !body.vehicleBrand || !body.vehicleModel) {
            throw new BadRequestException('Vehicle plate, brand, and model are required');
        }
        if (!body.categoryId || !body.date || !body.startTime) {
            throw new BadRequestException('Category, date, and start time are required');
        }
        return this.bookingService.book(slug, body);
    }
}
