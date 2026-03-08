import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { PdfService } from '../pdf/pdf.service';

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService, private pdfService: PdfService) { }

    async getLeaveReport(filters?: { from?: Date; to?: Date; departmentId?: string; userId?: string }) {
        return this.prisma.leaveRequest.findMany({
            where: {
                ...(filters?.userId && { userId: filters.userId }),
                ...(filters?.from || filters?.to
                    ? { createdAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } }
                    : {}),
                ...(filters?.departmentId && { user: { departmentId: filters.departmentId } }),
            },
            include: {
                user: { select: { fullName: true, employeeNumber: true, department: { select: { name: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getPermissionReport(filters?: { from?: Date; to?: Date; departmentId?: string }) {
        return this.prisma.permissionRequest.findMany({
            where: {
                ...(filters?.from || filters?.to
                    ? { createdAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } }
                    : {}),
                ...(filters?.departmentId && { user: { departmentId: filters.departmentId } }),
            },
            include: {
                user: { select: { fullName: true, employeeNumber: true, department: { select: { name: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getEmployeeReport(departmentId?: string) {
        return this.prisma.user.findMany({
            where: { ...(departmentId && { departmentId }), isActive: true },
            select: {
                id: true,
                employeeNumber: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
                jobTitle: true,
                isActive: true,
                createdAt: true,
                department: { select: { name: true } },
                leaveBalances: { where: { year: new Date().getFullYear() } },
            },
        });
    }

    async exportLeaveReportToExcel(filters?: any): Promise<Buffer> {
        const data = await this.getLeaveReport(filters);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Leave Report');

        sheet.columns = [
            { header: 'Employee', key: 'employee', width: 25 },
            { header: 'Emp. #', key: 'empNum', width: 15 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Leave Type', key: 'leaveType', width: 15 },
            { header: 'Start Date', key: 'startDate', width: 15 },
            { header: 'End Date', key: 'endDate', width: 15 },
            { header: 'Days', key: 'days', width: 10 },
            { header: 'Status', key: 'status', width: 20 },
            { header: 'Reason', key: 'reason', width: 30 },
        ];

        // Style header row
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };

        data.forEach((row) => {
            sheet.addRow({
                employee: row.user?.fullName,
                empNum: row.user?.employeeNumber,
                dept: (row.user as any)?.department?.name,
                leaveType: row.leaveType,
                startDate: new Date(row.startDate).toLocaleDateString(),
                endDate: new Date(row.endDate).toLocaleDateString(),
                days: row.totalDays,
                status: row.status,
                reason: row.reason,
            });
        });

        const arrayBuffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(arrayBuffer);
    }

    async exportPermissionReportToExcel(filters?: any): Promise<Buffer> {
        const data = await this.getPermissionReport(filters);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Permission Report');

        sheet.columns = [
            { header: 'Employee', key: 'employee', width: 25 },
            { header: 'Emp. #', key: 'empNum', width: 15 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Hours', key: 'hours', width: 10 },
            { header: 'Status', key: 'status', width: 20 },
        ];

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };

        data.forEach((row) => {
            sheet.addRow({
                employee: row.user?.fullName,
                empNum: row.user?.employeeNumber,
                dept: (row.user as any)?.department?.name,
                type: row.permissionType,
                date: new Date(row.requestDate).toLocaleDateString(),
                hours: row.hoursUsed,
                status: row.status,
            });
        });

        const arrayBuffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(arrayBuffer);
    }
}
