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
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'BRANCH_SECRETARY')
    findAll(
        @Req() req: any,
        @Query('departmentId') departmentId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('name') name?: string,
        @Query('phone') phone?: string,
        @Query('status') status?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('search') search?: string,
    ) {
        return this.usersService.findAll(req.user.id, req.user.role, {
            departmentId,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            name,
            phone,
            status,
            from,
            to,
            search,
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.usersService.findById(id);
    }

    @Get(':id/stats')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'BRANCH_SECRETARY', 'EMPLOYEE')
    getStats(@Param('id') id: string, @Req() req: any) {
        return this.usersService.getStats(id, req.user.id, req.user.role);
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

    @Post(':id/reset-data')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    resetEmployeeData(@Param('id') id: string, @Req() req: any) {
        return this.usersService.resetEmployeeData(id, req.user.id);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    deactivate(@Param('id') id: string, @Req() req: any) {
        return this.usersService.deactivate(id, req.user.id);
    }
}
