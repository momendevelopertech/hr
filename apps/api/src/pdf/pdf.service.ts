import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';

@Injectable()
export class PdfService {
    async generateLeaveRequestPdf(data: {
        employeeName: string;
        employeeNameAr?: string;
        employeeNumber: string;
        department?: string;
        leaveType: string;
        startDate: Date;
        endDate: Date;
        totalDays: number;
        reason?: string;
        status: string;
        requestId: string;
        managerComment?: string;
        hrComment?: string;
        approvedByMgrAt?: Date;
        approvedByHrAt?: Date;
    }): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers: Buffer[] = [];

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // Header
            doc.rect(0, 0, doc.page.width, 80).fill('#1e3a5f');
            doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('SPHINX HR System', 50, 25);
            doc.fontSize(12).text('Leave Request Form', 50, 52);

            // Reset color
            doc.fillColor('#1e3a5f');

            // Title
            doc.moveDown(2);
            doc.fontSize(16).font('Helvetica-Bold').text('LEAVE REQUEST', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Request ID: ${data.requestId}`, { align: 'center' });
            doc.fillColor('#1e3a5f');
            doc.moveDown(1);

            // Status badge
            const statusColors: Record<string, string> = {
                PENDING: '#f59e0b',
                MANAGER_APPROVED: '#3b82f6',
                HR_APPROVED: '#10b981',
                REJECTED: '#ef4444',
                CANCELLED: '#6b7280',
                DRAFT: '#9ca3af',
            };
            const statusColor = statusColors[data.status] || '#6b7280';
            doc.rect(50, doc.y, 120, 25).fill(statusColor);
            doc.fillColor('white').fontSize(11).text(data.status.replace('_', ' '), 55, doc.y - 18);
            doc.fillColor('#1e3a5f');
            doc.moveDown(1.5);

            // Employee Info Section
            doc.fontSize(13).font('Helvetica-Bold').text('Employee Information');
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
            doc.moveDown(0.5);

            const infoY = doc.y;
            doc.fontSize(10).font('Helvetica');
            doc.text(`Name: ${data.employeeName}`, 50, infoY);
            doc.text(`Employee #: ${data.employeeNumber}`, 300, infoY);
            doc.text(`Department: ${data.department || 'N/A'}`, 50, infoY + 18);
            if (data.employeeNameAr) doc.text(`الاسم: ${data.employeeNameAr}`, 300, infoY + 18);

            doc.moveDown(3);

            // Leave Details Section
            doc.fontSize(13).font('Helvetica-Bold').text('Leave Details');
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
            doc.moveDown(0.5);

            const detailsY = doc.y;
            doc.fontSize(10).font('Helvetica');
            doc.text(`Leave Type: ${data.leaveType}`, 50, detailsY);
            doc.text(`Total Days: ${data.totalDays} day(s)`, 300, detailsY);
            doc.text(`Start Date: ${new Date(data.startDate).toLocaleDateString('en-GB')}`, 50, detailsY + 18);
            doc.text(`End Date: ${new Date(data.endDate).toLocaleDateString('en-GB')}`, 300, detailsY + 18);
            if (data.reason) doc.text(`Reason: ${data.reason}`, 50, detailsY + 36, { width: 490 });

            doc.moveDown(4);

            // Approval Section
            doc.fontSize(13).font('Helvetica-Bold').text('Approval Status');
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
            doc.moveDown(0.5);

            const approvalY = doc.y;
            doc.fontSize(10).font('Helvetica');
            doc.text('Manager Approval:', 50, approvalY);
            doc.text(data.approvedByMgrAt ? `Approved on ${new Date(data.approvedByMgrAt).toLocaleDateString()}` : 'Pending', 200, approvalY);
            if (data.managerComment) doc.text(`Comment: ${data.managerComment}`, 50, approvalY + 18, { width: 490 });

            doc.text('HR Approval:', 50, approvalY + 40);
            doc.text(data.approvedByHrAt ? `Approved on ${new Date(data.approvedByHrAt).toLocaleDateString()}` : 'Pending', 200, approvalY + 40);
            if (data.hrComment) doc.text(`Comment: ${data.hrComment}`, 50, approvalY + 58, { width: 490 });

            doc.moveDown(5);

            // QR Code
            try {
                const qrData = `SPHINX-HR:LEAVE:${data.requestId}:${data.status}`;
                const qrBuffer = await QRCode.toBuffer(qrData, { width: 100 });
                doc.image(qrBuffer, 50, doc.y, { width: 80 });
                doc.text('Scan to verify', 50, doc.y + 85, { width: 80, align: 'center' });
            } catch (e) {
                // QR code generation failed, skip
            }

            // Footer
            const footerY = doc.page.height - 60;
            doc.moveTo(50, footerY).lineTo(545, footerY).stroke('#e5e7eb');
            doc.fontSize(8).fillColor('#999')
                .text(`Generated on ${new Date().toLocaleString()} | SPHINX HR System | Confidential`, 50, footerY + 10, { align: 'center', width: 495 });

            doc.end();
        });
    }

    async generatePermissionRequestPdf(data: any): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers: Buffer[] = [];
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            doc.rect(0, 0, doc.page.width, 80).fill('#1e3a5f');
            doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('SPHINX HR System', 50, 25);
            doc.fontSize(12).text('Permission Request Form', 50, 52);
            doc.fillColor('#1e3a5f');
            doc.moveDown(2);

            doc.fontSize(16).font('Helvetica-Bold').text('PERMISSION REQUEST', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#666').text(`Request ID: ${data.requestId || 'N/A'}`, { align: 'center' });
            doc.fillColor('#1e3a5f');
            doc.moveDown(1);

            doc.fontSize(10).font('Helvetica');
            const y = doc.y;
            doc.text(`Employee: ${data.employeeName}`, 50, y);
            doc.text(`Employee #: ${data.employeeNumber}`, 300, y);
            doc.text(`Department: ${data.department || 'N/A'}`, 50, y + 18);
            doc.text(`Permission Type: ${data.permissionType}`, 300, y + 18);
            doc.text(`Date: ${new Date(data.requestDate).toLocaleDateString('en-GB')}`, 50, y + 36);
            doc.text(`Hours Used: ${data.hoursUsed}h`, 300, y + 36);
            if (data.arrivalTime) doc.text(`Arrival Time: ${data.arrivalTime}`, 50, y + 54);
            if (data.leaveTime) doc.text(`Leave Time: ${data.leaveTime}`, 300, y + 54);
            if (data.reason) doc.text(`Reason: ${data.reason}`, 50, y + 72, { width: 490 });

            try {
                const qrBuffer = await QRCode.toBuffer(`SPHINX-HR:PERM:${data.requestId}:${data.status}`, { width: 100 });
                doc.image(qrBuffer, 50, doc.page.height - 160, { width: 80 });
            } catch (e) { }

            const footerY = doc.page.height - 60;
            doc.moveTo(50, footerY).lineTo(545, footerY).stroke('#e5e7eb');
            doc.fontSize(8).fillColor('#999').text(`Generated on ${new Date().toLocaleString()} | SPHINX HR System | Confidential`, 50, footerY + 10, { align: 'center', width: 495 });

            doc.end();
        });
    }

    async generateFormSubmissionPdf(data: {
        requestId: string;
        employeeName: string;
        employeeNumber: string;
        department?: string;
        formName: string;
        status: string;
        submittedAt: Date;
        fields: Array<{ label: string; value: string }>;
    }): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers: Buffer[] = [];
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            doc.rect(0, 0, doc.page.width, 80).fill('#1e3a5f');
            doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('SPHINX HR System', 50, 25);
            doc.fontSize(12).text('Dynamic Form Submission', 50, 52);
            doc.fillColor('#1e3a5f');
            doc.moveDown(2);

            doc.fontSize(16).font('Helvetica-Bold').text(data.formName, { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#666').text(`Request ID: ${data.requestId}`, { align: 'center' });
            doc.fillColor('#1e3a5f');
            doc.moveDown(1);

            doc.fontSize(10).font('Helvetica');
            const y = doc.y;
            doc.text(`Employee: ${data.employeeName}`, 50, y);
            doc.text(`Employee #: ${data.employeeNumber}`, 300, y);
            doc.text(`Department: ${data.department || 'N/A'}`, 50, y + 18);
            doc.text(`Status: ${data.status}`, 300, y + 18);
            doc.text(`Submitted: ${new Date(data.submittedAt).toLocaleString()}`, 50, y + 36);

            doc.moveDown(3);
            doc.fontSize(13).font('Helvetica-Bold').text('Form Data');
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
            doc.moveDown(0.5);

            doc.fontSize(10).font('Helvetica');
            data.fields.forEach((field) => {
                doc.text(`${field.label}: ${field.value}`, { width: 490 });
                doc.moveDown(0.3);
            });

            const footerY = doc.page.height - 60;
            doc.moveTo(50, footerY).lineTo(545, footerY).stroke('#e5e7eb');
            doc.fontSize(8).fillColor('#999').text(`Generated on ${new Date().toLocaleString()} | SPHINX HR System | Confidential`, 50, footerY + 10, { align: 'center', width: 495 });

            doc.end();
        });
    }
}
