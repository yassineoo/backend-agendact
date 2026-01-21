import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Get('contacts')
    async getContacts(@Request() req) {
        return this.chatService.getContacts(req.user.id, req.user.ctCenterId);
    }

    @Get('messages/:contactId')
    async getMessages(@Param('contactId') contactId: string, @Request() req) {
        return this.chatService.getMessages(req.user.id, contactId);
    }

    @Post('messages')
    async sendMessage(
        @Body() body: { receiverId: string; content: string },
        @Request() req,
    ) {
        return this.chatService.sendMessage(
            req.user.id,
            body.receiverId,
            body.content,
            req.user.ctCenterId || 'default',
        );
    }

    @Get('users')
    async getUsers(@Query('search') search: string, @Request() req) {
        return this.chatService.getUsers(req.user.id, search);
    }
}
