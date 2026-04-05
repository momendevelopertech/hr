import {
    Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';
import {
    CreateUserDto,
    UpdateOwnProfileDto,
    UpdateLeaveBalanceDto,
    UpdateUserDto,
    UpdateUserPasswordDto,
    UserHistoryQueryDto,
    UsersQueryDto,
} from './dto/users.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    create(@Body() body: CreateUserDto, @Req() req: any) {
        return this.usersService.create(body, req.user.id);
    }

    @Get()
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'BRANCH_SECRETARY')
    findAll(@Req() req: any, @Query() query: UsersQueryDto) {
        return this.usersService.findAll(req.user.id, req.user.role, {
            departmentId: query.departmentId,
            branchId: query.branchId,
            page: query.page ?? 1,
            limit: query.limit ?? 20,
            name: query.name,
            phone: query.phone,
            status: query.status,
            from: query.from,
            to: query.to,
            search: query.search,
            governorate: query.governorate,
        });
    }

    @Patch('me/profile')
    updateOwnProfile(@Body() body: UpdateOwnProfileDto, @Req() req: any) {
        return this.usersService.updateOwnProfile(req.user.id, body);
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

    @Get(':id/history')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'BRANCH_SECRETARY', 'EMPLOYEE')
    getHistory(@Param('id') id: string, @Req() req: any, @Query() query: UserHistoryQueryDto) {
        return this.usersService.getRequestHistory(id, req.user.id, req.user.role, {
            from: query.from,
            to: query.to,
            includeDetails: query.includeDetails,
        });
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    update(@Param('id') id: string, @Body() body: UpdateUserDto, @Req() req: any) {
        return this.usersService.update(id, body, req.user.id);
    }

    @Patch(':id/password')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    updatePassword(@Param('id') id: string, @Body() body: UpdateUserPasswordDto, @Req() req: any) {
        return this.usersService.updatePassword(id, body, req.user.id, req.user.role);
    }

    @Patch(':id/leave-balance')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'HR_ADMIN')
    updateLeaveBalance(
        @Param('id') id: string,
        @Body() body: UpdateLeaveBalanceDto,
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
    deletePermanently(@Param('id') id: string, @Req() req: any) {
        return this.usersService.deletePermanently(id, req.user.id, req.user.role);
    }
}
