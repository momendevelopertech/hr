import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('leaves')
@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
    constructor(private leavesService: LeavesService) { }

    @Get('balances')
    getBalances(@Req() req: any) {
        return this.leavesService.getBalances(req.user.id);
    }

    @Get()
    findAll(@Req() req: any, @Query('status') status?: string, @Query('userId') userId?: string) {
        return this.leavesService.findAll(req.user.id, req.user.role, { status: status as any, userId });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.leavesService.findOne(id);
    }

    @Post()
    create(@Body() body: any, @Req() req: any) {
        return this.leavesService.createRequest(req.user.id, body);
    }

    @Patch(':id/approve')
    @UseGuards(RolesGuard)
    @Roles('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')
    approve(@Param('id') id: string, @Body('comment') comment: string, @Req() req: any) {
        return this.leavesService.updateStatus(id, req.user.id, req.user.role, 'approve', comment);
    }

    @Patch(':id/reject')
    @UseGuards(RolesGuard)
    @Roles('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')
    reject(@Param('id') id: string, @Body('comment') comment: string, @Req() req: any) {
        return this.leavesService.updateStatus(id, req.user.id, req.user.role, 'reject', comment);
    }

    @Patch(':id/cancel')
    cancel(@Param('id') id: string, @Req() req: any) {
        return this.leavesService.cancelRequest(id, req.user.id, req.user.role);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
        return this.leavesService.updateRequest(id, req.user.id, req.user.role, body);
    }

    @Post(':id/duplicate')
    duplicate(@Param('id') id: string, @Req() req: any) {
        return this.leavesService.duplicateRequest(id, req.user.id, req.user.role);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    delete(@Param('id') id: string, @Req() req: any) {
        return this.leavesService.deleteRequest(id, req.user.id, req.user.role);
    }
}
