import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';
import { CurrentUser } from '../auth/decorators';
import { TenantGuard } from '../auth/guards';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('chat')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Get('contacts')
    async getContacts(@CurrentUser() user: any) {
        return this.chatService.getContacts(user.id, user.ctCenterId);
    }

    @Get('messages/:contactId')
    async getMessages(@Param('contactId') contactId: string, @CurrentUser() user: any) {
        return this.chatService.getMessages(user.id, contactId, user.ctCenterId);
    }

    @Post('messages')
    async sendMessage(
        @Body() body: CreateMessageDto,
        @CurrentUser() user: any,
    ) {
        return this.chatService.sendMessage(
            user.id,
            body.receiverId,
            body.content,
            user.ctCenterId,
        );
    }

    @Patch('messages/:contactId/read')
    async markAsRead(@Param('contactId') contactId: string, @CurrentUser() user: any) {
        return this.chatService.markAsRead(user.id, contactId, user.ctCenterId);
    }

    @Get('users')
    async getUsers(@Query('search') search: string, @CurrentUser() user: any) {
        return this.chatService.getUsers(user.id, search, user.isSuperAdmin ? undefined : user.ctCenterId);
    }
}
