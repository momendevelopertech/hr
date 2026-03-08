import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { differenceInBusinessDays, addDays } from 'date-fns';

@Injectable()
export class LeavesService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
        private auditService: AuditService,
    ) { }

    async getBalances(userId: string) {
        const year = new Date().getFullYear();
        return this.prisma.leaveBalance.findMany({
            where: { userId, year },
        });
    }

    async createRequest(userId: string, data: {
        leaveType: any;
        startDate: Date;
        endDate: Date;
        reason?: string;
        attachmentUrl?: string;
    }) {
        const balance = await this.prisma.leaveBalance.findUnique({
            where: {
                userId_year_leaveType: {
                    userId,
                    year: new Date().getFullYear(),
                    leaveType: data.leaveType,
                },
            },
        });

        if (!balance) throw new BadRequestException('Leave balance not found');

        const days = differenceInBusinessDays(new Date(data.endDate), new Date(data.startDate)) + 1;

        if (balance.remainingDays < days) {
            throw new BadRequestException(`Insufficient leave balance. Available: ${balance.remainingDays} days`);
        }

        const request = await this.prisma.leaveRequest.create({
            data: {
                userId,
                leaveType: data.leaveType,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                totalDays: days,
                reason: data.reason,
                attachmentUrl: data.attachmentUrl,
                status: 'PENDING',
            },
            include: { user: { include: { department: true } } },
        });

        await this.auditService.log({
            userId,
            action: 'LEAVE_REQUESTED',
            entity: 'LeaveRequest',
            entityId: request.id,
        });

        await this.notificationsService.notifyLeaveAction(request, 'submitted');

        // Notify managers in the department
        if (request.user.departmentId) {
            const managers = await this.prisma.user.findMany({
                where: {
                    departmentId: request.user.departmentId,
                    role: { in: ['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'] },
                },
            });

            for (const manager of managers) {
                await this.notificationsService.createInApp({
                    receiverId: manager.id,
                    senderId: userId,
                    type: 'LEAVE_REQUEST',
                    title: 'New Leave Request',
                    titleAr: 'طلب إجازة جديد',
                    body: `${request.user.fullName} submitted a ${request.leaveType} leave request.`,
                    bodyAr: `قدّم ${request.user.fullName} طلب إجازة.`,
                    metadata: { leaveRequestId: request.id },
                });
            }
        }

        return request;
    }

    async findAll(userId: string, role: string, filters?: { status?: any; userId?: string }) {
        const where: any = {};

        if (role === 'EMPLOYEE') {
            where.userId = userId;
        } else if (role === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: userId } });
            const employees = await this.prisma.user.findMany({
                where: { departmentId: manager.departmentId },
                select: { id: true },
            });
            where.userId = { in: employees.map((e) => e.id) };
        }

        if (filters?.status) where.status = filters.status;
        if (filters?.userId && (role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) {
            where.userId = filters.userId;
        }

        return this.prisma.leaveRequest.findMany({
            where,
            include: {
                user: { select: { fullName: true, fullNameAr: true, employeeNumber: true, department: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.leaveRequest.findUnique({
            where: { id },
            include: {
                user: { include: { department: true } },
            },
        });
    }

    async updateStatus(id: string, actorId: string, role: string, action: 'approve' | 'reject', comment?: string) {
        const request = await this.prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!request) throw new NotFoundException('Request not found');

        let newStatus: any;
        const updateData: any = { updatedAt: new Date() };

        if (role === 'MANAGER') {
            if (action === 'approve') {
                newStatus = 'MANAGER_APPROVED';
                updateData.approvedByMgrId = actorId;
                updateData.approvedByMgrAt = new Date();
            } else {
                newStatus = 'REJECTED';
            }
            updateData.managerComment = comment;
        } else if (role === 'HR_ADMIN' || role === 'SUPER_ADMIN') {
            if (action === 'approve') {
                newStatus = 'HR_APPROVED';
                updateData.approvedByHrId = actorId;
                updateData.approvedByHrAt = new Date();

                // Deduct days from balance
                await this.prisma.leaveBalance.update({
                    where: {
                        userId_year_leaveType: {
                            userId: request.userId,
                            year: new Date(request.startDate).getFullYear(),
                            leaveType: request.leaveType,
                        },
                    },
                    data: {
                        usedDays: { increment: request.totalDays },
                        remainingDays: { decrement: request.totalDays },
                    },
                });
            } else {
                newStatus = 'REJECTED';
            }
            updateData.hrComment = comment;
        }

        updateData.status = newStatus;

        const updated = await this.prisma.leaveRequest.update({
            where: { id },
            data: updateData,
        });

        await this.auditService.log({
            userId: actorId,
            action: action === 'approve' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
            entity: 'LeaveRequest',
            entityId: id,
        });

        await this.notificationsService.notifyLeaveAction(request, action === 'approve' ? 'approved' : 'rejected');

        // WhatsApp notify manager approval to HR
        if (newStatus === 'MANAGER_APPROVED') {
            const hrAdmins = await this.prisma.user.findMany({
                where: { role: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } },
            });
            for (const hr of hrAdmins) {
                await this.notificationsService.createInApp({
                    receiverId: hr.id,
                    type: 'LEAVE_REQUEST',
                    title: 'Leave Pending HR Approval',
                    titleAr: 'إجازة بانتظار موافقة HR',
                    body: `${request.user.fullName}'s leave has been approved by manager. Awaiting HR decision.`,
                    bodyAr: `تمت الموافقة على إجازة ${request.user.fullName} من المدير. بانتظار قرار HR.`,
                    metadata: { leaveRequestId: id },
                });
            }
        }

        return updated;
    }

    async cancelRequest(id: string, userId: string, role: string) {
        const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Not found');
        if (role === 'EMPLOYEE' && request.userId !== userId) throw new ForbiddenException();
        if (role === 'EMPLOYEE' && request.status !== 'PENDING') {
            throw new BadRequestException('Can only cancel pending requests');
        }

        await this.prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
        await this.auditService.log({ userId, action: 'LEAVE_CANCELLED', entity: 'LeaveRequest', entityId: id });
        return { message: 'Cancelled' };
    }

    async updateRequest(id: string, actorId: string, role: string, data: any) {
        const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Not found');

        if (role === 'EMPLOYEE') {
            if (request.userId !== actorId) throw new ForbiddenException();
            if (request.status !== 'PENDING') throw new BadRequestException('Can only edit pending requests');
        }

        const startDate = data.startDate ? new Date(data.startDate) : request.startDate;
        const endDate = data.endDate ? new Date(data.endDate) : request.endDate;
        const days = differenceInBusinessDays(endDate, startDate) + 1;

        const balance = await this.prisma.leaveBalance.findUnique({
            where: {
                userId_year_leaveType: {
                    userId: request.userId,
                    year: new Date(startDate).getFullYear(),
                    leaveType: data.leaveType ?? request.leaveType,
                },
            },
        });
        if (!balance) throw new BadRequestException('Leave balance not found');
        if (balance.remainingDays < days) {
            throw new BadRequestException(`Insufficient leave balance. Available: ${balance.remainingDays} days`);
        }

        const updated = await this.prisma.leaveRequest.update({
            where: { id },
            data: {
                leaveType: data.leaveType ?? request.leaveType,
                startDate,
                endDate,
                totalDays: days,
                reason: data.reason ?? request.reason,
                attachmentUrl: data.attachmentUrl ?? request.attachmentUrl,
            },
        });

        await this.auditService.log({ userId: actorId, action: 'REQUEST_EDITED', entity: 'LeaveRequest', entityId: id });
        return updated;
    }

    async deleteRequest(id: string, actorId: string, role: string) {
        if (!(role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) throw new ForbiddenException();
        await this.prisma.leaveRequest.delete({ where: { id } });
        await this.auditService.log({ userId: actorId, action: 'REQUEST_DELETED', entity: 'LeaveRequest', entityId: id });
        return { message: 'Deleted' };
    }

    async duplicateRequest(id: string, actorId: string, role: string) {
        const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Not found');
        if (role === 'EMPLOYEE' && request.userId !== actorId) throw new ForbiddenException();

        return this.createRequest(request.userId, {
            leaveType: request.leaveType,
            startDate: request.startDate,
            endDate: request.endDate,
            reason: request.reason,
            attachmentUrl: request.attachmentUrl,
        });
    }
}
