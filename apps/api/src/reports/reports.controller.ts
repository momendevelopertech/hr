import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HR_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'BRANCH_SECRETARY')
export class ReportsController {
    constructor(private reportsService: ReportsService) { }

    @Get('leaves')
    getLeaveReport(@Query() query: any, @Req() req: any) {
        return this.reportsService.getLeaveReport(req.user.id, req.user.role, query);
    }

    @Get('permissions')
    getPermissionReport(@Query() query: any, @Req() req: any) {
        return this.reportsService.getPermissionReport(req.user.id, req.user.role, query);
    }

    @Get('forms')
    getFormsReport(@Query() query: any, @Req() req: any) {
        return this.reportsService.getFormsReport(req.user.id, req.user.role, query);
    }

    @Get('employee-summary')
    getEmployeeSummary(@Query() query: any, @Req() req: any) {
        return this.reportsService.getEmployeeSummary(req.user.id, req.user.role, query);
    }

    @Get('pending')
    getPending(@Query() query: any, @Req() req: any) {
        return this.reportsService.getPendingRequests(req.user.id, req.user.role, query);
    }

    @Get('summary')
    getSummary(@Req() req: any) {
        return this.reportsService.getMonthlySummary(req.user.id, req.user.role);
    }

    @Get('leaves/excel')
    async exportLeavesExcel(@Query() query: any, @Res() res: Response, @Req() req: any) {
        const buffer = await this.reportsService.exportLeaveReportToExcel(req.user.id, req.user.role, query);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="leave-report.xlsx"',
        });
        res.end(buffer);
    }

    @Get('permissions/excel')
    async exportPermissionsExcel(@Query() query: any, @Res() res: Response, @Req() req: any) {
        const buffer = await this.reportsService.exportPermissionReportToExcel(req.user.id, req.user.role, query);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="permission-report.xlsx"',
        });
        res.end(buffer);
    }
}
