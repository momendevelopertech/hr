import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { differenceInBusinessDays, endOfDay, startOfDay } from 'date-fns';
import { getCycleRange } from '../shared/cycle';
import { CreateLeaveDto, UpdateLeaveDto } from './dto/leaves.dto';

@Injectable()
export class LeavesService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
        private auditService: AuditService,
    ) { }

    private async getWorkflowUserIds(
        requestUserId: string,
        requestUser: { governorate?: any; departmentId?: string | null },
        actorId?: string,
    ) {
        const [secretaries, managers, hrAdmins] = await Promise.all([
            requestUser?.governorate
                ? this.prisma.user.findMany({
                    where: { governorate: requestUser.governorate, role: 'BRANCH_SECRETARY' },
                    select: { id: true },
                })
                : Promise.resolve([]),
            requestUser?.departmentId
                ? this.prisma.user.findMany({
                    where: { departmentId: requestUser.departmentId, role: 'MANAGER' },
                    select: { id: true },
                })
                : Promise.resolve([]),
            this.prisma.user.findMany({
                where: { role: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } },
                select: { id: true },
            }),
        ]);

        const ids = new Set<string>();
        ids.add(requestUserId);
        if (actorId) ids.add(actorId);
        secretaries.forEach((user) => ids.add(user.id));
        managers.forEach((user) => ids.add(user.id));
        hrAdmins.forEach((user) => ids.add(user.id));
        return Array.from(ids);
    }

    private async emitWorkflowUpdate(request: { id: string; userId: string; user: { governorate?: any; departmentId?: string | null } }, actorId?: string) {
        const userIds = await this.getWorkflowUserIds(request.userId, request.user, actorId);
        await this.notificationsService.emitRealtimeToUsers(userIds, {
            type: 'REQUEST_UPDATED',
            requestType: 'leave',
            requestId: request.id,
        });
    }

    private async resolveTargetUserId(targetUserId: string, actor?: { id: string; role: string }) {
        if (!actor || actor.id === targetUserId) return targetUserId;
        if (actor.role !== 'BRANCH_SECRETARY') {
            throw new ForbiddenException('Only branch secretary can submit requests for other employees');
        }
        const [secretary, target] = await Promise.all([
            this.prisma.user.findUnique({ where: { id: actor.id } }),
            this.prisma.user.findUnique({ where: { id: targetUserId } }),
        ]);
        if (!secretary || !target || !secretary.governorate || secretary.governorate !== target.governorate) {
            throw new ForbiddenException('Secretary can only submit requests for their branch');
        }
        return targetUserId;
    }

    private async ensureYearBalances(userId: string, year: number) {
        const defaults: Array<{ leaveType: any; days: number }> = [
            { leaveType: 'ANNUAL', days: 21 },
            { leaveType: 'CASUAL', days: 7 },
            { leaveType: 'EMERGENCY', days: 3 },
            { leaveType: 'MISSION', days: 10 },
        ];

        for (const item of defaults) {
            await this.prisma.leaveBalance.upsert({
                where: {
                    userId_year_leaveType: {
                        userId,
                        year,
                        leaveType: item.leaveType,
                    },
                },
                update: {},
                create: {
                    userId,
                    year,
                    leaveType: item.leaveType,
                    totalDays: item.days,
                    usedDays: 0,
                    remainingDays: item.days,
                },
            });
        }
    }

    async getBalances(userId: string) {
        const year = new Date().getFullYear();
        await this.ensureYearBalances(userId, year);
        return this.prisma.leaveBalance.findMany({
            where: { userId, year },
        });
    }

    async getMonthlyAbsenceDeduction(userId: string, role: string, month?: string) {
        const now = month ? new Date(`${month}-01`) : new Date();
        const { start: cycleStart, end: cycleEnd } = getCycleRange(now, { endOfDay: true });

        const where: any = {
            leaveType: 'ABSENCE_WITH_PERMISSION',
            status: 'HR_APPROVED',
            startDate: { gte: cycleStart, lte: cycleEnd },
        };
        if (role === 'EMPLOYEE') {
            where.userId = userId;
        } else if (role === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: userId } });
            const employees = await this.prisma.user.findMany({
                where: { departmentId: manager?.departmentId || undefined },
                select: { id: true },
            });
            where.userId = { in: employees.map((e) => e.id) };
        } else if (role === 'BRANCH_SECRETARY') {
            const secretary = await this.prisma.user.findUnique({ where: { id: userId } });
            if (secretary?.governorate) {
                const employees = await this.prisma.user.findMany({
                    where: { governorate: secretary.governorate },
                    select: { id: true },
                });
                where.userId = { in: employees.map((e) => e.id) };
            }
        }

        const requests = await this.prisma.leaveRequest.findMany({
            where,
            select: { totalDays: true },
        });

        const latenessEntries = await this.prisma.lateness.findMany({
            where: {
                ...(where.userId ? { userId: where.userId } : {}),
                date: { gte: cycleStart, lte: cycleEnd },
            },
            select: { id: true },
        });

        const latenessCount = latenessEntries.length;
        const latenessDeductionDays = latenessCount >= 3 ? 1 : latenessCount === 2 ? 0.5 : latenessCount === 1 ? 0.25 : 0;
        const absenceDays = requests.reduce((sum, req) => sum + req.totalDays, 0);

        return {
            cycleStart,
            cycleEnd,
            deductedDays: absenceDays + latenessDeductionDays,
            absenceDays,
            latenessDeductionDays,
            latenessCount,
        };
    }

    async createRequest(userId: string, data: CreateLeaveDto, actor?: { id: string; role: string }) {
        const targetUserId = await this.resolveTargetUserId(userId, actor);
        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                workflowMode: true,
            },
        });
        if (!targetUser) {
            throw new NotFoundException('Employee not found');
        }

        const year = new Date(data.startDate).getFullYear();
        await this.ensureYearBalances(targetUserId, year);
        const isSandbox = targetUser.workflowMode === 'SANDBOX';

        const days = differenceInBusinessDays(new Date(data.endDate), new Date(data.startDate)) + 1;
        if (days <= 0) {
            throw new BadRequestException('End date must be same day or after start date');
        }

        if (data.leaveType !== 'ABSENCE_WITH_PERMISSION') {
            const balance = await this.prisma.leaveBalance.findUnique({
                where: {
                    userId_year_leaveType: {
                        userId: targetUserId,
                        year,
                        leaveType: data.leaveType,
                    },
                },
            });

            if (!balance) throw new BadRequestException('Leave balance not found');
            if (balance.remainingDays < days) {
                throw new BadRequestException(`Insufficient leave balance. Available: ${balance.remainingDays} days`);
            }
        }

        const request = await this.prisma.leaveRequest.create({
            data: {
                userId: targetUserId,
                leaveType: data.leaveType,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                totalDays: days,
                reason: data.reason,
                attachmentUrl: data.attachmentUrl,
                status: isSandbox ? 'HR_APPROVED' : 'PENDING',
                ...(isSandbox ? { approvedByHrAt: new Date() } : {}),
            },
            include: { user: { include: { department: true } } },
        });

        if (isSandbox && data.leaveType !== 'ABSENCE_WITH_PERMISSION') {
            await this.prisma.leaveBalance.update({
                where: {
                    userId_year_leaveType: {
                        userId: targetUserId,
                        year,
                        leaveType: data.leaveType,
                    },
                },
                data: {
                    usedDays: { increment: days },
                    remainingDays: { decrement: days },
                },
            });
        }

        const actorId = actor?.id || targetUserId;
        await this.auditService.log({
            userId: actorId,
            action: 'LEAVE_REQUESTED',
            entity: 'LeaveRequest',
            entityId: request.id,
            details: {
                ...(actorId === targetUserId ? {} : { requestFor: targetUserId }),
                ...(isSandbox ? { autoApproved: true, workflowMode: 'SANDBOX' } : {}),
            },
        });

        if (isSandbox) {
            await this.auditService.log({
                userId: actorId,
                action: 'LEAVE_APPROVED',
                entity: 'LeaveRequest',
                entityId: request.id,
                details: { autoApproved: true, workflowMode: 'SANDBOX' },
            });

            await this.notificationsService.notifyLeaveAction(request, 'approved', {
                sendExternal: false,
                body: 'Your leave request was auto-approved in Sandbox Mode.',
                bodyAr: 'تم اعتماد طلب الإجازة تلقائيًا في وضع التجربة.',
            });
            await this.notificationsService.emitRealtimeToUsers([targetUserId, actorId], {
                type: 'REQUEST_UPDATED',
                requestType: 'leave',
                requestId: request.id,
            });
            return request;
        }

        await this.notificationsService.notifyLeaveAction(request, 'submitted');

        if (request.user.governorate) {
            const managers = await this.prisma.user.findMany({
                where: {
                    governorate: request.user.governorate,
                    role: 'BRANCH_SECRETARY',
                },
            });

            for (const manager of managers) {
                await this.notificationsService.createInApp({
                    receiverId: manager.id,
                    senderId: targetUserId,
                    type: 'LEAVE_REQUEST',
                    title: 'New Leave Request',
                    titleAr: 'طلب إجازة جديد',
                    body: `${request.user.fullName} submitted a ${request.leaveType} leave request.`,
                    bodyAr: 'تم تقديم طلب إجازة جديد.',
                    metadata: { leaveRequestId: request.id },
                });
            }
        }

        await this.emitWorkflowUpdate(request, actorId);

        return request;
    }

    async findAll(userId: string, role: string, filters?: { status?: any; userId?: string; includeSelf?: boolean }) {
        const where: any = {};
        const secretaryStatuses = ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED'];
        const managerStatuses = ['MANAGER_APPROVED', 'HR_APPROVED'];
        const hrStatuses = ['MANAGER_APPROVED', 'HR_APPROVED'];
        const sandboxAutoApprovedWhere = {
            status: 'HR_APPROVED',
            approvedByMgrId: null,
            approvedByHrId: null,
        };

        if (role === 'EMPLOYEE') {
            where.userId = userId;
        } else if (role === 'BRANCH_SECRETARY') {
            const secretary = await this.prisma.user.findUnique({ where: { id: userId } });
            if (secretary?.governorate) {
                const employees = await this.prisma.user.findMany({
                    where: { governorate: secretary.governorate },
                    select: { id: true },
                });
                where.userId = { in: employees.map((e) => e.id) };
                where.status = { in: secretaryStatuses };
            }
        } else if (role === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: userId } });
            const employees = await this.prisma.user.findMany({
                where: { departmentId: manager.departmentId },
                select: { id: true },
            });
            where.userId = { in: employees.map((e) => e.id) };
            where.status = { in: managerStatuses };
        } else if (role === 'HR_ADMIN' || role === 'SUPER_ADMIN') {
            where.status = { in: hrStatuses };
            where.OR = [
                { approvedByMgrId: { not: null } },
                sandboxAutoApprovedWhere,
            ];
        }

        if (filters?.status && (role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) {
            if (hrStatuses.includes(filters.status)) {
                where.status = filters.status;
                where.OR = filters.status === 'HR_APPROVED'
                    ? [
                        { approvedByMgrId: { not: null } },
                        sandboxAutoApprovedWhere,
                    ]
                    : [{ approvedByMgrId: { not: null } }];
            } else {
                where.status = { in: [] };
                where.OR = undefined;
            }
        }
        if (filters?.userId && (role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) {
            where.userId = filters.userId;
        }
        if (!where.userId && !(role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) {
            where.userId = userId;
        }

        const finalWhere = filters?.includeSelf
            ? { OR: [{ userId }, where] }
            : where;

        return this.prisma.leaveRequest.findMany({
            where: finalWhere,
            include: {
                user: {
                    select: {
                        fullName: true,
                        fullNameAr: true,
                        employeeNumber: true,
                        governorate: true,
                        department: { select: { id: true, name: true, nameAr: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.leaveRequest.findUnique({
            where: { id },
            include: {
                user: { include: { department: true } },
                approvedByMgr: { select: { fullName: true, fullNameAr: true } },
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

        if (role === 'BRANCH_SECRETARY') {
            if (request.status !== 'PENDING') {
                // Idempotent guard for stale/double clicks.
                if (action === 'approve' && ['MANAGER_APPROVED', 'HR_APPROVED'].includes(request.status)) return request;
                if (action === 'reject' && request.status === 'REJECTED') return request;
                if (request.status === 'CANCELLED') return request;
                throw new BadRequestException('Secretary can only process pending requests');
            }
            newStatus = action === 'approve' ? 'MANAGER_APPROVED' : 'REJECTED';
            updateData.managerComment = comment;
        } else if (role === 'MANAGER') {
            if (request.status !== 'MANAGER_APPROVED' || request.approvedByMgrId) {
                // Idempotent guard for stale/double clicks.
                if (action === 'approve' && (request.status === 'HR_APPROVED' || (request.status === 'MANAGER_APPROVED' && request.approvedByMgrId))) {
                    return request;
                }
                if (action === 'reject' && request.status === 'REJECTED') return request;
                if (request.status === 'CANCELLED') return request;
                throw new BadRequestException('Manager can only process secretary-approved requests');
            }
            if (action === 'approve') {
                newStatus = 'MANAGER_APPROVED';
                updateData.approvedByMgrId = actorId;
                updateData.approvedByMgrAt = new Date();
            } else {
                newStatus = 'REJECTED';
            }
            updateData.managerComment = comment;
        } else if (role === 'HR_ADMIN' || role === 'SUPER_ADMIN') {
            if (request.status !== 'MANAGER_APPROVED' || !request.approvedByMgrId) {
                // Idempotent guard for stale/double clicks.
                if (action === 'approve' && request.status === 'HR_APPROVED') return request;
                if (action === 'reject' && request.status === 'REJECTED') return request;
                if (request.status === 'CANCELLED') return request;
                throw new BadRequestException('HR can only process manager-approved requests');
            }
            if (action === 'approve') {
                newStatus = 'HR_APPROVED';
                updateData.approvedByHrId = actorId;
                updateData.approvedByHrAt = new Date();

                if (request.leaveType !== 'ABSENCE_WITH_PERMISSION') {
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
                }
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

        if (action === 'reject') {
            await this.notificationsService.notifyLeaveAction(request, 'rejected');
            return updated;
        }

        if (role === 'BRANCH_SECRETARY') {
            const jobs: Promise<any>[] = [
                this.notificationsService.notifyLeaveAction(request, 'verified'),
            ];

            if (request.user.departmentId) {
                const managers = await this.prisma.user.findMany({
                    where: { role: 'MANAGER', departmentId: request.user.departmentId },
                    select: { id: true },
                });

                jobs.push(this.notificationsService.createInAppBulk(
                    managers.map((manager) => ({
                        receiverId: manager.id,
                        senderId: actorId,
                        type: 'LEAVE_REQUEST',
                        title: 'Leave Request Needs Approval',
                        titleAr: 'طلب إجازة يحتاج موافقتك',
                        body: `${request.user.fullName} has a leave request verified by the secretary.`,
                        bodyAr: 'تم التحقق من طلب الإجازة وبانتظار موافقتك.',
                        metadata: { leaveRequestId: id },
                    })),
                ));
            }

            await Promise.all(jobs);
        } else if (role === 'MANAGER') {
            const hrAdmins = await this.prisma.user.findMany({
                where: { role: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } },
                select: { id: true },
            });

            await Promise.all([
                this.notificationsService.notifyLeaveAction(request, 'managerApproved'),
                this.notificationsService.createInAppBulk(
                    hrAdmins.map((hr) => ({
                        receiverId: hr.id,
                        type: 'LEAVE_REQUEST',
                        title: 'Leave Pending HR Approval',
                        titleAr: 'طلب إجازة بانتظار موافقة الموارد البشرية',
                        body: `${request.user.fullName}'s leave has been approved by manager. Awaiting HR decision.`,
                        bodyAr: 'تمت موافقة المدير على طلب الإجازة وبانتظار الموارد البشرية.',
                        metadata: { leaveRequestId: id },
                    })),
                ),
            ]);
        } else if (role === 'HR_ADMIN' || role === 'SUPER_ADMIN') {
            await this.notificationsService.notifyLeaveAction(request, 'approved');
        }

        await this.emitWorkflowUpdate({ ...request, id }, actorId);

        return updated;
    }

    async cancelRequest(id: string, userId: string, role: string) {
        const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Not found');
        if (request.userId !== userId) {
            throw new ForbiddenException('Only request owner can cancel');
        }
        if (request.status !== 'PENDING') {
            throw new BadRequestException('Can only cancel pending requests');
        }

        await this.prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
        await this.auditService.log({ userId, action: 'LEAVE_CANCELLED', entity: 'LeaveRequest', entityId: id });
        return { message: 'Cancelled' };
    }

    async updateRequest(id: string, actorId: string, role: string, data: UpdateLeaveDto) {
        const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Not found');

        if (role === 'EMPLOYEE') {
            if (request.userId !== actorId) throw new ForbiddenException();
            if (request.status !== 'PENDING') throw new BadRequestException('Can only edit pending requests');
        }

        const startDate = data.startDate ? new Date(data.startDate) : request.startDate;
        const endDate = data.endDate ? new Date(data.endDate) : request.endDate;
        const days = differenceInBusinessDays(endDate, startDate) + 1;
        if (days <= 0) {
            throw new BadRequestException('End date must be same day or after start date');
        }

        const finalLeaveType = data.leaveType ?? request.leaveType;
        if (finalLeaveType !== 'ABSENCE_WITH_PERMISSION') {
            const balance = await this.prisma.leaveBalance.findUnique({
                where: {
                    userId_year_leaveType: {
                        userId: request.userId,
                        year: new Date(startDate).getFullYear(),
                        leaveType: finalLeaveType,
                    },
                },
            });
            if (!balance) throw new BadRequestException('Leave balance not found');
            if (balance.remainingDays < days) {
                throw new BadRequestException(`Insufficient leave balance. Available: ${balance.remainingDays} days`);
            }
        }

        const updated = await this.prisma.leaveRequest.update({
            where: { id },
            data: {
                leaveType: finalLeaveType,
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
        const request = await this.prisma.leaveRequest.findUnique({ where: { id }, select: { status: true } });
        if (!request) throw new NotFoundException('Not found');
        if (['MANAGER_APPROVED', 'HR_APPROVED'].includes(request.status)) {
            throw new BadRequestException('Cannot delete an approved request');
        }
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
            startDate: request.startDate.toISOString().slice(0, 10),
            endDate: request.endDate.toISOString().slice(0, 10),
            reason: request.reason,
            attachmentUrl: request.attachmentUrl,
        });
    }
}
