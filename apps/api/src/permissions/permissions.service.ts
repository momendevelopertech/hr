import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { Cron } from '@nestjs/schedule';
import { getCycleRange } from '../shared/cycle';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/permissions.dto';

@Injectable()
export class PermissionsService {
    private static readonly MAX_REQUESTS_PER_CYCLE = 2;

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
            requestType: 'permission',
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

    private async canDeleteOwnSandboxRequest(actorId: string, role: string, requestUserId: string) {
        if (role !== 'EMPLOYEE' || actorId !== requestUserId) {
            return false;
        }

        const actor = await this.prisma.user.findUnique({
            where: { id: actorId },
            select: { workflowMode: true },
        });

        return actor?.workflowMode === 'SANDBOX';
    }

    // Permission cycle: day 11 to day 10 next month.
    private getCycleForDate(date: Date): { start: Date; end: Date } {
        return getCycleRange(date, { endOfDay: false });
    }

    private parseHours(arrivalTime?: string, leaveTime?: string) {
        if (!arrivalTime || !leaveTime) {
            return null;
        }

        const [startH, startM] = arrivalTime.split(':').map(Number);
        const [endH, endM] = leaveTime.split(':').map(Number);
        if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) {
            throw new BadRequestException('Invalid time format');
        }

        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const diff = Math.abs(endMinutes - startMinutes) / 60;
        if (diff <= 0) {
            throw new BadRequestException('Permission duration must be greater than zero');
        }

        return diff;
    }

    private formatTime(hours: number, minutes: number) {
        const h = String(Math.max(0, Math.min(23, hours))).padStart(2, '0');
        const m = String(Math.max(0, Math.min(59, minutes))).padStart(2, '0');
        return `${h}:${m}`;
    }

    private parseMinutes(time: string, fallbackMinutes: number) {
        const [hours, minutes] = time.split(':').map((part) => Number(part));
        if ([hours, minutes].some((value) => Number.isNaN(value))) return fallbackMinutes;
        return (hours * 60) + minutes;
    }

    private parseDateOnly(value?: string | null) {
        if (!value) return null;
        const [year, month, day] = value.split('-').map((part) => Number(part));
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }

    private async getWorkWindow(requestDate: Date) {
        const settings = await this.prisma.workScheduleSettings.findFirst({
            select: {
                activeMode: true,
                weekdayStart: true,
                weekdayEnd: true,
                saturdayStart: true,
                saturdayEnd: true,
                ramadanStart: true,
                ramadanEnd: true,
                ramadanStartDate: true,
                ramadanEndDate: true,
            },
        });

        const defaults = {
            weekdayStart: '09:00',
            weekdayEnd: '17:00',
            saturdayStart: '09:00',
            saturdayEnd: '13:30',
            ramadanStart: '09:00',
            ramadanEnd: '14:30',
        };

        const dateOnly = new Date(requestDate.getFullYear(), requestDate.getMonth(), requestDate.getDate());
        const ramadanStart = this.parseDateOnly(settings?.ramadanStartDate ?? null);
        const ramadanEnd = this.parseDateOnly(settings?.ramadanEndDate ?? null);
        const isRamadan =
            settings?.activeMode === 'RAMADAN'
            && !!ramadanStart
            && !!ramadanEnd
            && dateOnly >= ramadanStart
            && dateOnly <= ramadanEnd;
        const isSaturday = requestDate.getDay() === 6;

        const startTime = isRamadan
            ? (settings?.ramadanStart || defaults.ramadanStart)
            : isSaturday
                ? (settings?.saturdayStart || defaults.saturdayStart)
                : (settings?.weekdayStart || defaults.weekdayStart);
        const endTime = isRamadan
            ? (settings?.ramadanEnd || defaults.ramadanEnd)
            : isSaturday
                ? (settings?.saturdayEnd || defaults.saturdayEnd)
                : (settings?.weekdayEnd || defaults.weekdayEnd);

        return {
            startMinutes: this.parseMinutes(startTime, 9 * 60),
            endMinutes: this.parseMinutes(endTime, 17 * 60),
        };
    }

    private async buildTimesFromScope(scope: 'ARRIVAL' | 'DEPARTURE', durationHours: number, requestDate: Date) {
        const { startMinutes, endMinutes } = await this.getWorkWindow(requestDate);
        const durationMinutes = Math.round(durationHours * 60);
        if (durationMinutes <= 0) {
            throw new BadRequestException('Permission duration must be greater than zero');
        }

        if (scope === 'ARRIVAL') {
            const arrival = startMinutes + durationMinutes;
            return {
                arrivalTime: this.formatTime(Math.floor(arrival / 60), arrival % 60),
                leaveTime: this.formatTime(Math.floor(endMinutes / 60), endMinutes % 60),
            };
        }

        const leave = endMinutes - durationMinutes;
        if (leave <= startMinutes) {
            throw new BadRequestException('Permission duration exceeds working window for selected day');
        }
        return {
            arrivalTime: this.formatTime(Math.floor(startMinutes / 60), startMinutes % 60),
            leaveTime: this.formatTime(Math.floor(leave / 60), leave % 60),
        };
    }

    private async getReservedHoursInCycle(cycleId: string, excludeRequestId?: string) {
        const result = await this.prisma.permissionRequest.aggregate({
            _sum: { hoursUsed: true },
            where: {
                cycleId,
                status: { in: ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED'] },
                ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
            },
        });

        return result._sum.hoursUsed ?? 0;
    }

    private async getApprovedHoursInCycle(cycleId: string, excludeRequestId?: string) {
        const result = await this.prisma.permissionRequest.aggregate({
            _sum: { hoursUsed: true },
            where: {
                cycleId,
                status: 'HR_APPROVED',
                ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
            },
        });

        return result._sum.hoursUsed ?? 0;
    }

    private async getRequestCountInCycle(cycleId: string, excludeRequestId?: string) {
        return this.prisma.permissionRequest.count({
            where: {
                cycleId,
                status: { not: 'CANCELLED' },
                ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
            },
        });
    }

    private async buildCycleSnapshot(cycle: {
        id: string;
        userId: string;
        cycleStart: Date;
        cycleEnd: Date;
        totalHours: number;
        usedHours: number;
        remainingHours: number;
    }) {
        const [reservedHours, approvedHours] = await Promise.all([
            this.getReservedHoursInCycle(cycle.id),
            this.getApprovedHoursInCycle(cycle.id),
        ]);
        const totalHours = cycle.totalHours ?? 4;

        return {
            ...cycle,
            reservedHours,
            approvedHours,
            usedHours: approvedHours,
            remainingHours: Math.max(0, totalHours - reservedHours),
        };
    }

    private async syncCycleUsage(cycleId: string) {
        const cycle = await this.prisma.permissionCycle.findUnique({ where: { id: cycleId } });
        if (!cycle) return null;

        const snapshot = await this.buildCycleSnapshot(cycle);

        await this.prisma.permissionCycle.update({
            where: { id: cycle.id },
            data: {
                usedHours: snapshot.usedHours,
                remainingHours: snapshot.remainingHours,
            },
        });

        return snapshot;
    }

    async getOrCreateCycle(userId: string, date: Date = new Date()) {
        const { start, end } = this.getCycleForDate(date);

        let cycle = await this.prisma.permissionCycle.findUnique({
            where: { userId_cycleStart: { userId, cycleStart: start } },
        });

        if (!cycle) {
            cycle = await this.prisma.permissionCycle.create({
                data: {
                    userId,
                    cycleStart: start,
                    cycleEnd: end,
                    totalHours: 4,
                    usedHours: 0,
                    remainingHours: 4,
                },
            });
        }

        return cycle;
    }

    async getCurrentCycle(userId: string) {
        const cycle = await this.getOrCreateCycle(userId, new Date());
        return this.buildCycleSnapshot(cycle);
    }

    async createRequest(userId: string, data: CreatePermissionDto, actor?: { id: string; role: string }) {
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

        const requestDate = new Date(data.requestDate);
        const cycle = await this.getOrCreateCycle(targetUserId, requestDate);
        const isSandbox = targetUser.workflowMode === 'SANDBOX';

        let hoursUsed = this.parseHours(data.arrivalTime, data.leaveTime);
        let arrivalTime = data.arrivalTime;
        let leaveTime = data.leaveTime;
        let permissionType = data.permissionType;

        if (data.permissionScope) {
            if (!data.durationMinutes || data.durationMinutes <= 0) {
                throw new BadRequestException('Permission duration is required');
            }
            const durationHours = data.durationMinutes / 60;
            const times = await this.buildTimesFromScope(data.permissionScope, durationHours, requestDate);
            hoursUsed = durationHours;
            arrivalTime = times.arrivalTime;
            leaveTime = times.leaveTime;
            permissionType = data.permissionScope === 'ARRIVAL' ? 'LATE_ARRIVAL' : 'EARLY_LEAVE';
        }
        if (!hoursUsed) {
            if (permissionType === 'PERSONAL') {
                throw new BadRequestException('Personal permission requires start and end time');
            }
            hoursUsed = 2;
        }

        const requestCount = await this.getRequestCountInCycle(cycle.id);
        if (requestCount >= PermissionsService.MAX_REQUESTS_PER_CYCLE) {
            throw new BadRequestException('You have already used your 2 permission requests for this cycle');
        }

        const reservedHours = await this.getReservedHoursInCycle(cycle.id);
        const availableHours = Math.max(0, cycle.totalHours - reservedHours);
        if (availableHours < hoursUsed) {
            throw new BadRequestException(
                `Insufficient permission hours. Available: ${availableHours}h, Requested: ${hoursUsed}h`,
            );
        }

        const request = await this.prisma.permissionRequest.create({
            data: {
                userId: targetUserId,
                cycleId: cycle.id,
                permissionType,
                requestDate,
                arrivalTime,
                leaveTime,
                hoursUsed,
                reason: data.reason,
                status: isSandbox ? 'HR_APPROVED' : 'PENDING',
                ...(isSandbox ? { approvedByHrAt: new Date() } : {}),
            },
            include: { user: { include: { department: true } } },
        });

        await this.syncCycleUsage(cycle.id);

        const actorId = actor?.id || targetUserId;
        const permissionLabels: Record<string, { ar: string; en: string }> = {
            PERSONAL: { ar: 'طلب إذن شخصي', en: 'personal permission request' },
            LATE_ARRIVAL: { ar: 'طلب إذن تأخير', en: 'late-arrival permission request' },
            EARLY_LEAVE: { ar: 'طلب إذن انصراف مبكر', en: 'early-leave permission request' },
        };
        await this.auditService.log({
            userId: actorId,
            action: 'PERMISSION_REQUESTED',
            entity: 'PermissionRequest',
            entityId: request.id,
            details: {
                ...(actorId === targetUserId ? {} : { requestFor: targetUserId }),
                ...(isSandbox ? { autoApproved: true, workflowMode: 'SANDBOX' } : {}),
            },
        });

        const receiptLabel = permissionLabels[request.permissionType] || { ar: 'طلب إذن', en: 'permission request' };
        const deliverySummary = await this.notificationsService.sendRequestReceipt({
            user: request.user,
            requestType: 'permission',
            requestId: request.id,
            requestLabelAr: receiptLabel.ar,
            requestLabelEn: receiptLabel.en,
            status: isSandbox ? 'HR_APPROVED' : 'PENDING',
            requestDetails: {
                permissionType: request.permissionType,
                requestDate: request.requestDate,
                arrivalTime: request.arrivalTime,
                leaveTime: request.leaveTime,
                hoursUsed: request.hoursUsed,
                reason: request.reason,
            },
            waitForExternalDeliveries: true,
        });

        if (isSandbox) {
            await this.auditService.log({
                userId: actorId,
                action: 'PERMISSION_APPROVED',
                entity: 'PermissionRequest',
                entityId: request.id,
                details: { autoApproved: true, workflowMode: 'SANDBOX' },
            });

            await this.notificationsService.notifyPermissionAction(request, 'approved', {
                sendExternal: false,
                body: 'Your permission request was auto-approved in Sandbox Mode.',
                bodyAr: 'تم اعتماد طلب الإذن تلقائيًا في وضع التجربة.',
            });
            await this.notificationsService.emitRealtimeToUsers([targetUserId, actorId], {
                type: 'REQUEST_UPDATED',
                requestType: 'permission',
                requestId: request.id,
            });
            return {
                ...request,
                emailDelivery: deliverySummary.emailDelivery,
                whatsAppDelivery: deliverySummary.whatsAppDelivery,
            };
        }

        await this.notificationsService.notifyPermissionAction(request, 'submitted');

        if (request.user.governorate) {
            const managers = await this.prisma.user.findMany({
                where: {
                    governorate: request.user.governorate,
                    role: 'BRANCH_SECRETARY',
                },
            });

            for (const mgr of managers) {
                await this.notificationsService.createInApp({
                    receiverId: mgr.id,
                    senderId: targetUserId,
                    type: 'PERMISSION_REQUEST',
                    title: 'New Permission Request',
                    titleAr: 'طلب إذن جديد',
                    body: `${request.user.fullName} requested ${hoursUsed}h permission on ${new Date(data.requestDate).toLocaleDateString()}.`,
                    bodyAr: 'تم تقديم طلب إذن جديد.',
                    metadata: { permissionRequestId: request.id },
                });
            }
        }

        await this.emitWorkflowUpdate(request, actorId);

        return {
            ...request,
            emailDelivery: deliverySummary.emailDelivery,
            whatsAppDelivery: deliverySummary.whatsAppDelivery,
        };
    }

    async findAll(userId: string, role: string, filters?: { includeSelf?: boolean }) {
        const where: any = {};
        const secretaryStatuses = ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED'];
        const managerStatuses = ['MANAGER_APPROVED', 'HR_APPROVED'];
        const hrStatuses = ['MANAGER_APPROVED', 'HR_APPROVED'];
        const sandboxAutoApprovedWhere = {
            status: 'HR_APPROVED',
            approvedByMgrId: null,
            approvedByHrId: null,
        };
        if (role === 'EMPLOYEE') where.userId = userId;
        else if (role === 'BRANCH_SECRETARY') {
            const secretary = await this.prisma.user.findUnique({ where: { id: userId } });
            if (secretary?.governorate) {
                const employees = await this.prisma.user.findMany({ where: { governorate: secretary.governorate }, select: { id: true } });
                where.userId = { in: employees.map((e) => e.id) };
                where.status = { in: secretaryStatuses };
            }
        } else if (role === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: userId } });
            const employees = await this.prisma.user.findMany({ where: { departmentId: manager.departmentId }, select: { id: true } });
            where.userId = { in: employees.map((e) => e.id) };
            where.status = { in: managerStatuses };
        } else if (role === 'HR_ADMIN' || role === 'SUPER_ADMIN') {
            where.status = { in: hrStatuses };
            where.OR = [
                { approvedByMgrId: { not: null } },
                sandboxAutoApprovedWhere,
            ];
        }
        if (!where.userId && !(role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) {
            where.userId = userId;
        }

        const finalWhere = filters?.includeSelf
            ? { OR: [{ userId }, where] }
            : where;

        return this.prisma.permissionRequest.findMany({
            where: finalWhere,
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        fullNameAr: true,
                        employeeNumber: true,
                        governorate: true,
                        department: { select: { id: true, name: true, nameAr: true } },
                    },
                },
                cycle: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.permissionRequest.findUnique({
            where: { id },
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
                cycle: true,
                approvedByMgr: { select: { fullName: true, fullNameAr: true } },
            },
        });
    }

    async updateStatus(id: string, actorId: string, role: string, action: 'approve' | 'reject', comment?: string) {
        const request = await this.prisma.permissionRequest.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!request) throw new NotFoundException('Not found');

        let newStatus: any;
        const updateData: any = {};

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
            newStatus = action === 'approve' ? 'MANAGER_APPROVED' : 'REJECTED';
            updateData.managerComment = comment;
            if (action === 'approve') {
                updateData.approvedByMgrId = actorId;
                updateData.approvedByMgrAt = new Date();
            }
        } else {
            if (request.status !== 'MANAGER_APPROVED' || !request.approvedByMgrId) {
                // Idempotent guard for stale/double clicks.
                if (action === 'approve' && request.status === 'HR_APPROVED') return request;
                if (action === 'reject' && request.status === 'REJECTED') return request;
                if (request.status === 'CANCELLED') return request;
                throw new BadRequestException('HR can only process manager-approved requests');
            }
            newStatus = action === 'approve' ? 'HR_APPROVED' : 'REJECTED';
            updateData.hrComment = comment;
            if (action === 'approve') {
                const cycle = await this.prisma.permissionCycle.findUnique({ where: { id: request.cycleId } });
                if (!cycle) {
                    throw new BadRequestException('Insufficient remaining hours in permission cycle');
                }
                const approvedHours = await this.getApprovedHoursInCycle(cycle.id);
                const remainingApprovedHours = Math.max(0, cycle.totalHours - approvedHours);
                if (remainingApprovedHours < request.hoursUsed) {
                    throw new BadRequestException('Insufficient remaining hours in permission cycle');
                }

                updateData.approvedByHrId = actorId;
                updateData.approvedByHrAt = new Date();
            }
        }

        updateData.status = newStatus;
        const updated = await this.prisma.permissionRequest.update({ where: { id }, data: updateData });
        await this.syncCycleUsage(request.cycleId);

        await this.auditService.log({
            userId: actorId,
            action: action === 'approve' ? 'PERMISSION_APPROVED' : 'PERMISSION_REJECTED',
            entity: 'PermissionRequest',
            entityId: id,
        });

        if (action === 'reject') {
            await this.notificationsService.notifyPermissionAction(request, 'rejected', { comment, sendExternal: true });
            return updated;
        }

        if (role === 'BRANCH_SECRETARY') {
            const jobs: Promise<any>[] = [
                this.notificationsService.notifyPermissionAction(request, 'verified'),
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
                        type: 'PERMISSION_REQUEST',
                        title: 'Permission Request Needs Approval',
                        titleAr: 'طلب إذن يحتاج موافقتك',
                        body: `${request.user.fullName} has a permission request verified by the secretary.`,
                        bodyAr: 'تم التحقق من طلب الإذن وبانتظار موافقتك.',
                        metadata: { permissionRequestId: id },
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
                this.notificationsService.notifyPermissionAction(request, 'managerApproved'),
                this.notificationsService.createInAppBulk(
                    hrAdmins.map((hr) => ({
                        receiverId: hr.id,
                        type: 'PERMISSION_REQUEST',
                        title: 'Permission Pending HR Approval',
                        titleAr: 'طلب إذن بانتظار موافقة الموارد البشرية',
                        body: `${request.user.fullName}'s permission has been approved by manager. Awaiting HR decision.`,
                        bodyAr: 'تمت موافقة المدير على طلب الإذن وبانتظار الموارد البشرية.',
                        metadata: { permissionRequestId: id },
                    })),
                ),
            ]);
        } else {
            await this.notificationsService.notifyPermissionAction(request, 'approved', { comment, sendExternal: true });
        }

        await this.emitWorkflowUpdate({ ...request, id }, actorId);

        return updated;
    }

    async updateRequest(id: string, actorId: string, role: string, data: UpdatePermissionDto) {
        const request = await this.prisma.permissionRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Not found');
        if (role === 'EMPLOYEE') {
            if (request.userId !== actorId) throw new ForbiddenException();
            if (request.status !== 'PENDING') throw new BadRequestException('Can only edit pending requests');
        }

        const nextRequestDate = data.requestDate ? new Date(data.requestDate) : request.requestDate;
        const cycle = await this.getOrCreateCycle(request.userId, nextRequestDate);
        let arrivalTime = data.arrivalTime ?? request.arrivalTime;
        let leaveTime = data.leaveTime ?? request.leaveTime;
        let permissionType = data.permissionType ?? request.permissionType;

        let hoursUsed = this.parseHours(arrivalTime, leaveTime);
        if (data.permissionScope) {
            if (!data.durationMinutes || data.durationMinutes <= 0) {
                throw new BadRequestException('Permission duration is required');
            }
            const durationHours = data.durationMinutes / 60;
            const times = await this.buildTimesFromScope(data.permissionScope, durationHours, nextRequestDate);
            hoursUsed = durationHours;
            arrivalTime = times.arrivalTime;
            leaveTime = times.leaveTime;
            permissionType = data.permissionScope === 'ARRIVAL' ? 'LATE_ARRIVAL' : 'EARLY_LEAVE';
        }
        if (!hoursUsed) {
            if (permissionType === 'PERSONAL') {
                throw new BadRequestException('Personal permission requires start and end time');
            }
            hoursUsed = 2;
        }

        const requestCount = await this.getRequestCountInCycle(cycle.id, id);
        if (requestCount >= PermissionsService.MAX_REQUESTS_PER_CYCLE) {
            throw new BadRequestException('You have already used your 2 permission requests for this cycle');
        }

        const reservedHours = await this.getReservedHoursInCycle(cycle.id, id);
        const availableHours = Math.max(0, cycle.totalHours - reservedHours);
        if (availableHours < hoursUsed) {
            throw new BadRequestException(
                `Insufficient permission hours. Available: ${availableHours}h, Requested: ${hoursUsed}h`,
            );
        }

        const updated = await this.prisma.permissionRequest.update({
            where: { id },
            data: {
                permissionType,
                requestDate: nextRequestDate,
                cycleId: cycle.id,
                arrivalTime,
                leaveTime,
                hoursUsed,
                reason: data.reason ?? request.reason,
            },
        });
        if (request.cycleId !== cycle.id) {
            await this.syncCycleUsage(request.cycleId);
        }
        await this.syncCycleUsage(cycle.id);

        await this.auditService.log({ userId: actorId, action: 'REQUEST_EDITED', entity: 'PermissionRequest', entityId: id });
        return updated;
    }

    async cancelRequest(id: string, actorId: string, role: string) {
        const request = await this.prisma.permissionRequest.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        governorate: true,
                        departmentId: true,
                    },
                },
            },
        });
        if (!request) throw new NotFoundException('Not found');
        if (request.userId !== actorId) throw new ForbiddenException('Only request owner can cancel');
        if (request.status !== 'PENDING') throw new BadRequestException('Can only cancel pending requests');
        await this.prisma.permissionRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
        await this.syncCycleUsage(request.cycleId);
        await this.auditService.log({ userId: actorId, action: 'PERMISSION_CANCELLED', entity: 'PermissionRequest', entityId: id });
        await this.emitWorkflowUpdate(request, actorId);
        return { message: 'Cancelled' };
    }

    async deleteRequest(id: string, actorId: string, role: string) {
        const request = await this.prisma.permissionRequest.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        governorate: true,
                        departmentId: true,
                    },
                },
            },
        });
        if (!request) throw new NotFoundException('Not found');

        const isAdmin = role === 'HR_ADMIN' || role === 'SUPER_ADMIN';
        const canDeleteOwnSandboxRequest = await this.canDeleteOwnSandboxRequest(actorId, role, request.userId);

        if (!isAdmin && !canDeleteOwnSandboxRequest) {
            throw new ForbiddenException();
        }

        if (isAdmin && ['MANAGER_APPROVED', 'HR_APPROVED'].includes(request.status)) {
            throw new BadRequestException('Cannot delete an approved request');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.lateness.updateMany({
                where: { permissionId: id },
                data: {
                    convertedToPermission: false,
                    permissionId: null,
                },
            });
            await tx.permissionRequest.delete({ where: { id } });
        });

        await this.syncCycleUsage(request.cycleId);
        await this.auditService.log({ userId: actorId, action: 'REQUEST_DELETED', entity: 'PermissionRequest', entityId: id });
        await this.emitWorkflowUpdate(request, actorId);
        return { message: 'Deleted' };
    }

    async duplicateRequest(id: string, actorId: string, role: string) {
        const request = await this.prisma.permissionRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Not found');
        if (role === 'EMPLOYEE' && request.userId !== actorId) throw new ForbiddenException();

        return this.createRequest(request.userId, {
            permissionType: request.permissionType,
            requestDate: request.requestDate.toISOString().slice(0, 10),
            arrivalTime: request.arrivalTime,
            leaveTime: request.leaveTime,
            reason: request.reason,
        });
    }

    @Cron('0 0 11 * *')
    async resetCycles() {
        const users = await this.prisma.user.findMany({ select: { id: true } });
        for (const user of users) {
            await this.getOrCreateCycle(user.id);
        }
    }
}
