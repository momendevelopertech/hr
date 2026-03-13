import { Controller, Get, Patch, Param, UseGuards, Req, Query, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private notificationsService: NotificationsService) { }

    @Get()
    getAll(
        @Req() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('type') type?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        return this.notificationsService.getAll(req.user.id, {
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            type,
            status,
            search,
            from,
            to,
        });
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

    @Post('announcement')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    createAnnouncement(
        @Req() req: any,
        @Body() body: { title: string; titleAr?: string; body: string; bodyAr?: string },
    ) {
        return this.notificationsService.broadcastToAll({
            senderId: req.user.id,
            type: 'ANNOUNCEMENT',
            title: body.title,
            titleAr: body.titleAr || body.title,
            body: body.body,
            bodyAr: body.bodyAr || body.body,
            metadata: { kind: 'ANNOUNCEMENT' },
        });
    }

    @Post('payroll')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    triggerPayroll(@Req() req: any) {
        return this.notificationsService.broadcastToAll({
            senderId: req.user.id,
            type: 'ANNOUNCEMENT',
            title: 'Payroll Released',
            titleAr: 'تم صرف الرواتب',
            body: 'Your salary has been released. Thank you for your work!',
            bodyAr: 'تم صرف الرواتب. شكرًا لجهودكم!',
            metadata: { kind: 'PAYROLL' },
        });
    }
}

