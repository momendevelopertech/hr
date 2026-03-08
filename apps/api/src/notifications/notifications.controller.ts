import { Controller, Get, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private notificationsService: NotificationsService) { }

    @Get()
    getAll(@Req() req: any) {
        return this.notificationsService.getAll(req.user.id);
    }

    @Get('unread')
    getUnread(@Req() req: any) {
        return this.notificationsService.getUnread(req.user.id);
    }

    @Patch(':id/read')
    markRead(@Param('id') id: string, @Req() req: any) {
        return this.notificationsService.markRead(id, req.user.id);
    }

    @Patch('read-all')
    markAllRead(@Req() req: any) {
        return this.notificationsService.markAllRead(req.user.id);
    }
}
