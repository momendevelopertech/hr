import {
    Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    create(@Body() body: any, @Req() req: any) {
        return this.usersService.create(body, req.user.id);
    }

    @Get()
    findAll(@Req() req: any, @Query('departmentId') departmentId?: string) {
        return this.usersService.findAll(req.user.id, req.user.role, departmentId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.usersService.findById(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
        return this.usersService.update(id, body, req.user.id);
    }

    @Patch(':id/leave-balance')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    updateLeaveBalance(
        @Param('id') id: string,
        @Body() body: { leaveType: string; year: number; totalDays: number },
    ) {
        return this.usersService.updateLeaveBalance(id, body.leaveType, body.year, body.totalDays);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    deactivate(@Param('id') id: string, @Req() req: any) {
        return this.usersService.deactivate(id, req.user.id);
    }
}
