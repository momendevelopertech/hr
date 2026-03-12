import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
    constructor(private permissionsService: PermissionsService) { }

    @Get('cycle')
    getCycle(@Req() req: any) {
        return this.permissionsService.getCurrentCycle(req.user.id);
    }

    @Get()
    findAll(@Req() req: any) {
        return this.permissionsService.findAll(req.user.id, req.user.role);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.permissionsService.findOne(id);
    }

    @Post()
    create(@Body() body: any, @Req() req: any) {
        return this.permissionsService.createRequest(req.user.id, body);
    }

    @Patch(':id/approve')
    @UseGuards(RolesGuard)
    @Roles('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')
    approve(@Param('id') id: string, @Body('comment') comment: string, @Req() req: any) {
        return this.permissionsService.updateStatus(id, req.user.id, req.user.role, 'approve', comment);
    }

    @Patch(':id/reject')
    @UseGuards(RolesGuard)
    @Roles('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')
    reject(@Param('id') id: string, @Body('comment') comment: string, @Req() req: any) {
        return this.permissionsService.updateStatus(id, req.user.id, req.user.role, 'reject', comment);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
        return this.permissionsService.updateRequest(id, req.user.id, req.user.role, body);
    }

    @Patch(':id/cancel')
    cancel(@Param('id') id: string, @Req() req: any) {
        return this.permissionsService.cancelRequest(id, req.user.id, req.user.role);
    }

    @Post(':id/duplicate')
    duplicate(@Param('id') id: string, @Req() req: any) {
        return this.permissionsService.duplicateRequest(id, req.user.id, req.user.role);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    delete(@Param('id') id: string, @Req() req: any) {
        return this.permissionsService.deleteRequest(id, req.user.id, req.user.role);
    }
}
