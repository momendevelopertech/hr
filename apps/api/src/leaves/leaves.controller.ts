import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';
import { CreateLeaveDto, LeaveDecisionDto, UpdateLeaveDto } from './dto/leaves.dto';

@ApiTags('leaves')
@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
    constructor(private leavesService: LeavesService) { }

    @Get('balances')
    getBalances(@Req() req: any) {
        return this.leavesService.getBalances(req.user.id);
    }

    @Get('absence-deductions')
    getAbsenceDeductions(@Req() req: any, @Query('month') month?: string) {
        return this.leavesService.getMonthlyAbsenceDeduction(req.user.id, req.user.role, month);
    }

    @Get()
    findAll(
        @Req() req: any,
        @Query('status') status?: string,
        @Query('userId') userId?: string,
        @Query('includeSelf') includeSelf?: string,
    ) {
        return this.leavesService.findAll(req.user.id, req.user.role, {
            status: status as any,
            userId,
            includeSelf: includeSelf === '1' || includeSelf === 'true',
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.leavesService.findOne(id);
    }

    @Post()
    create(@Body() body: CreateLeaveDto, @Req() req: any) {
        const targetUserId = body.userId || req.user.id;
        return this.leavesService.createRequest(targetUserId, body, { id: req.user.id, role: req.user.role });
    }

    @Patch(':id/approve')
    @UseGuards(RolesGuard)
    @Roles('BRANCH_SECRETARY', 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')
    approve(@Param('id') id: string, @Body() body: LeaveDecisionDto, @Req() req: any) {
        return this.leavesService.updateStatus(id, req.user.id, req.user.role, 'approve', body.comment);
    }

    @Patch(':id/reject')
    @UseGuards(RolesGuard)
    @Roles('BRANCH_SECRETARY', 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')
    reject(@Param('id') id: string, @Body() body: LeaveDecisionDto, @Req() req: any) {
        return this.leavesService.updateStatus(id, req.user.id, req.user.role, 'reject', body.comment);
    }

    @Patch(':id/cancel')
    cancel(@Param('id') id: string, @Req() req: any) {
        return this.leavesService.cancelRequest(id, req.user.id, req.user.role);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() body: UpdateLeaveDto, @Req() req: any) {
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
