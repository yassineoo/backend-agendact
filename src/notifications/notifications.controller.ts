import { Controller, Get, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
    constructor(private notificationsService: NotificationsService) { }

    @Get()
    async findAll(
        @CurrentUser() user: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('unreadOnly') unreadOnly?: string,
    ) {
        return this.notificationsService.findAll(user.id, {
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            unreadOnly: unreadOnly === 'true',
        });
    }

    @Get('unread-count')
    async getUnreadCount(@CurrentUser() user: any) {
        return this.notificationsService.getUnreadCount(user.id);
    }

    @Patch(':id/read')
    async markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
        await this.notificationsService.markAsRead(user.id, id);
        return { success: true };
    }

    @Patch('read-all')
    async markAllAsRead(@CurrentUser() user: any) {
        await this.notificationsService.markAllAsRead(user.id);
        return { success: true };
    }

    @Delete(':id')
    async delete(@CurrentUser() user: any, @Param('id') id: string) {
        await this.notificationsService.delete(user.id, id);
        return { success: true };
    }
}
