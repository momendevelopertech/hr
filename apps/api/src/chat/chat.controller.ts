import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(private chatService: ChatService) { }

    @Get('employees')
    getEmployees(@Req() req: any, @Query('search') search?: string) {
        return this.chatService.getEmployees(req.user.id, search);
    }

    @Get('chats')
    getEmployeeChats(@Req() req: any) {
        return this.chatService.getEmployeeChats(req.user.id);
    }

    @Get('conversation/:employeeId')
    getConversation(@Req() req: any, @Param('employeeId') employeeId: string) {
        return this.chatService.getConversation(req.user.id, employeeId);
    }

    @Post('messages')
    sendMessage(@Req() req: any, @Body() dto: SendMessageDto) {
        return this.chatService.sendMessage(req.user.id, dto);
    }

    @Patch('messages/read/:employeeId')
    markAsRead(@Req() req: any, @Param('employeeId') employeeId: string) {
        return this.chatService.markAsRead(req.user.id, employeeId);
    }
}
