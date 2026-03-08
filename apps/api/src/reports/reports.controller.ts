import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HR_ADMIN', 'SUPER_ADMIN')
export class ReportsController {
    constructor(private reportsService: ReportsService) { }

    @Get('leaves')
    getLeaveReport(@Query() query: any) {
        return this.reportsService.getLeaveReport(query);
    }

    @Get('permissions')
    getPermissionReport(@Query() query: any) {
        return this.reportsService.getPermissionReport(query);
    }

    @Get('employees')
    getEmployeeReport(@Query('departmentId') deptId?: string) {
        return this.reportsService.getEmployeeReport(deptId);
    }

    @Get('leaves/excel')
    async exportLeavesExcel(@Query() query: any, @Res() res: Response) {
        const buffer = await this.reportsService.exportLeaveReportToExcel(query);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="leave-report.xlsx"',
        });
        res.end(buffer);
    }

    @Get('permissions/excel')
    async exportPermissionsExcel(@Query() query: any, @Res() res: Response) {
        const buffer = await this.reportsService.exportPermissionReportToExcel(query);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="permission-report.xlsx"',
        });
        res.end(buffer);
    }
}
