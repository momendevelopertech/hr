import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('pdf')
@Controller('pdf')
@UseGuards(JwtAuthGuard)
export class PdfController {
    constructor(private pdfService: PdfService, private prisma: PrismaService) { }

    @Get('leave/:id')
    async downloadLeave(@Param('id') id: string, @Res() res: Response) {
        const request = await this.prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: { include: { department: true } } },
        });

        if (!request) return res.status(404).json({ message: 'Not found' });

        const pdf = await this.pdfService.generateLeaveRequestPdf({
            requestId: request.id,
            employeeName: request.user.fullName,
            employeeNameAr: request.user.fullNameAr,
            employeeNumber: request.user.employeeNumber,
            department: request.user.department?.name,
            leaveType: request.leaveType,
            startDate: request.startDate,
            endDate: request.endDate,
            totalDays: request.totalDays,
            reason: request.reason,
            status: request.status,
            managerComment: request.managerComment,
            hrComment: request.hrComment,
            approvedByMgrAt: request.approvedByMgrAt,
            approvedByHrAt: request.approvedByHrAt,
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="leave-${id}.pdf"`,
            'Content-Length': pdf.length,
        });

        res.end(pdf);
    }

    @Get('permission/:id')
    async downloadPermission(@Param('id') id: string, @Res() res: Response) {
        const request = await this.prisma.permissionRequest.findUnique({
            where: { id },
            include: { user: { include: { department: true } } },
        });

        if (!request) return res.status(404).json({ message: 'Not found' });

        const pdf = await this.pdfService.generatePermissionRequestPdf({
            requestId: request.id,
            employeeName: request.user.fullName,
            employeeNumber: request.user.employeeNumber,
            department: request.user.department?.name,
            permissionType: request.permissionType,
            requestDate: request.requestDate,
            arrivalTime: request.arrivalTime,
            leaveTime: request.leaveTime,
            hoursUsed: request.hoursUsed,
            reason: request.reason,
            status: request.status,
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="permission-${id}.pdf"`,
            'Content-Length': pdf.length,
        });

        res.end(pdf);
    }

    @Get('form/:id')
    async downloadForm(@Param('id') id: string, @Res() res: Response) {
        const submission = await this.prisma.formSubmission.findUnique({
            where: { id },
            include: { user: { include: { department: true } }, form: { include: { fields: true } } },
        });

        if (!submission) return res.status(404).json({ message: 'Not found' });

        const data = submission.data as Record<string, any>;
        const fields = submission.form.fields.map((field) => ({
            label: field.label,
            value: data[field.id] !== undefined ? String(data[field.id]) : '',
        }));

        const pdf = await this.pdfService.generateFormSubmissionPdf({
            requestId: submission.id,
            employeeName: submission.user.fullName,
            employeeNumber: submission.user.employeeNumber,
            department: submission.user.department?.name,
            formName: submission.form.name,
            status: submission.status,
            submittedAt: submission.createdAt,
            fields,
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="form-${id}.pdf"`,
            'Content-Length': pdf.length,
        });

        res.end(pdf);
    }
}
