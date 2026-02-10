import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';
import { CurrentUser } from '../auth/decorators';
import { TenantGuard } from '../auth/guards';

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
        return this.chatService.getMessages(user.id, contactId);
    }

    @Post('messages')
    async sendMessage(
        @Body() body: { receiverId: string; content: string },
        @CurrentUser() user: any,
    ) {
        return this.chatService.sendMessage(
            user.id,
            body.receiverId,
            body.content,
            user.ctCenterId,
        );
    }

    @Get('users')
    async getUsers(@Query('search') search: string, @CurrentUser() user: any) {
        return this.chatService.getUsers(user.id, search);
    }
}
