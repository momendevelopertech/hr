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

    private buildTimesFromScope(scope: 'ARRIVAL' | 'DEPARTURE', durationHours: number) {
        const startMinutes = 9 * 60;
        const endMinutes = 17 * 60;
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
        return this.getOrCreateCycle(userId, new Date());
    }

    async createRequest(userId: string, data: CreatePermissionDto, actor?: { id: string; role: string }) {
        const targetUserId = await this.resolveTargetUserId(userId, actor);
        const requestDate = new Date(data.requestDate);
        const cycle = await this.getOrCreateCycle(targetUserId, requestDate);

        let hoursUsed = this.parseHours(data.arrivalTime, data.leaveTime);
        let arrivalTime = data.arrivalTime;
        let leaveTime = data.leaveTime;
        let permissionType = data.permissionType;

        if (data.permissionScope) {
            if (!data.durationMinutes || data.durationMinutes <= 0) {
                throw new BadRequestException('Permission duration is required');
            }
            const durationHours = data.durationMinutes / 60;
            const times = this.buildTimesFromScope(data.permissionScope, durationHours);
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

        const reservedHours = await this.getReservedHoursInCycle(cycle.id);
        const availableHours = Math.max(0, 4 - reservedHours);
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
                status: 'PENDING',
            },
            include: { user: { include: { department: true } } },
        });

        const actorId = actor?.id || targetUserId;
        await this.auditService.log({
            userId: actorId,
            action: 'PERMISSION_REQUESTED',
            entity: 'PermissionRequest',
            entityId: request.id,
            details: actorId === targetUserId ? undefined : { requestFor: targetUserId },
        });

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

        return request;
    }

    async findAll(userId: string, role: string, filters?: { includeSelf?: boolean }) {
        const where: any = {};
        const secretaryStatuses = ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED'];
        const managerStatuses = ['MANAGER_APPROVED', 'HR_APPROVED'];
        const hrStatuses = ['MANAGER_APPROVED', 'HR_APPROVED'];
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
            where.approvedByMgrId = { not: null };
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
                throw new BadRequestException('Secretary can only process pending requests');
            }
            newStatus = action === 'approve' ? 'MANAGER_APPROVED' : 'REJECTED';
            updateData.managerComment = comment;
        } else if (role === 'MANAGER') {
            if (request.status !== 'MANAGER_APPROVED' || request.approvedByMgrId) {
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
                throw new BadRequestException('HR can only process manager-approved requests');
            }
            newStatus = action === 'approve' ? 'HR_APPROVED' : 'REJECTED';
            updateData.hrComment = comment;
            if (action === 'approve') {
                const cycle = await this.prisma.permissionCycle.findUnique({ where: { id: request.cycleId } });
                if (!cycle || cycle.remainingHours < request.hoursUsed) {
                    throw new BadRequestException('Insufficient remaining hours in permission cycle');
                }

                updateData.approvedByHrId = actorId;
                updateData.approvedByHrAt = new Date();
                await this.prisma.permissionCycle.update({
                    where: { id: request.cycleId },
                    data: {
                        usedHours: { increment: request.hoursUsed },
                        remainingHours: { decrement: request.hoursUsed },
                    },
                });
            }
        }

        updateData.status = newStatus;
        const updated = await this.prisma.permissionRequest.update({ where: { id }, data: updateData });

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
            await this.notificationsService.notifyPermissionAction(request, 'verified');

            if (request.user.departmentId) {
                const managers = await this.prisma.user.findMany({
                    where: { role: 'MANAGER', departmentId: request.user.departmentId },
                });

                for (const manager of managers) {
                    await this.notificationsService.createInApp({
                        receiverId: manager.id,
                        senderId: actorId,
                        type: 'PERMISSION_REQUEST',
                        title: 'Permission Request Needs Approval',
                        titleAr: 'طلب إذن يحتاج موافقتك',
                        body: `${request.user.fullName} has a permission request verified by the secretary.`,
                        bodyAr: 'تم التحقق من طلب الإذن وبانتظار موافقتك.',
                        metadata: { permissionRequestId: id },
                    });
                }
            }
        } else if (role === 'MANAGER') {
            await this.notificationsService.notifyPermissionAction(request, 'managerApproved');

            const hrAdmins = await this.prisma.user.findMany({
                where: { role: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } },
            });

            for (const hr of hrAdmins) {
                await this.notificationsService.createInApp({
                    receiverId: hr.id,
                    type: 'PERMISSION_REQUEST',
                    title: 'Permission Pending HR Approval',
                    titleAr: 'طلب إذن بانتظار موافقة الموارد البشرية',
                    body: `${request.user.fullName}'s permission has been approved by manager. Awaiting HR decision.`,
                    bodyAr: 'تمت موافقة المدير على طلب الإذن وبانتظار الموارد البشرية.',
                    metadata: { permissionRequestId: id },
                });
            }
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
            const times = this.buildTimesFromScope(data.permissionScope, durationHours);
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

        const reservedHours = await this.getReservedHoursInCycle(cycle.id, id);
        const availableHours = Math.max(0, 4 - reservedHours);
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

        await this.auditService.log({ userId: actorId, action: 'REQUEST_EDITED', entity: 'PermissionRequest', entityId: id });
        return updated;
    }

    async cancelRequest(id: string, actorId: string, role: string) {
        const request = await this.prisma.permissionRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Not found');
        if (request.userId !== actorId) throw new ForbiddenException('Only request owner can cancel');
        if (request.status !== 'PENDING') throw new BadRequestException('Can only cancel pending requests');
        await this.prisma.permissionRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
        await this.auditService.log({ userId: actorId, action: 'PERMISSION_CANCELLED', entity: 'PermissionRequest', entityId: id });
        return { message: 'Cancelled' };
    }

    async deleteRequest(id: string, actorId: string, role: string) {
        if (!(role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) throw new ForbiddenException();
        const request = await this.prisma.permissionRequest.findUnique({ where: { id }, select: { status: true } });
        if (!request) throw new NotFoundException('Not found');
        if (['MANAGER_APPROVED', 'HR_APPROVED'].includes(request.status)) {
            throw new BadRequestException('Cannot delete an approved request');
        }
        await this.prisma.permissionRequest.delete({ where: { id } });
        await this.auditService.log({ userId: actorId, action: 'REQUEST_DELETED', entity: 'PermissionRequest', entityId: id });
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
