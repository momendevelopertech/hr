import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { addMonths, setDate, startOfDay } from 'date-fns';

@Injectable()
export class PermissionsService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
        private auditService: AuditService,
    ) { }

    // Permission cycle: Day 11 → Day 10 next month
    private getCycleForDate(date: Date): { start: Date; end: Date } {
        const d = date.getDate();
        let cycleStart: Date;
        let cycleEnd: Date;

        if (d >= 11) {
            cycleStart = startOfDay(setDate(date, 11));
            cycleEnd = startOfDay(setDate(addMonths(date, 1), 10));
        } else {
            const prevMonth = addMonths(date, -1);
            cycleStart = startOfDay(setDate(prevMonth, 11));
            cycleEnd = startOfDay(setDate(date, 10));
        }

        return { start: cycleStart, end: cycleEnd };
    }

    async getOrCreateCycle(userId: string) {
        const { start, end } = this.getCycleForDate(new Date());

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
        return this.getOrCreateCycle(userId);
    }

    async createRequest(userId: string, data: {
        permissionType: any;
        requestDate: Date;
        arrivalTime?: string;
        leaveTime?: string;
        reason?: string;
    }) {
        const cycle = await this.getOrCreateCycle(userId);

        // Calculate hours 
        let hoursUsed = 0;
        if (data.arrivalTime && data.leaveTime) {
            const [startH, startM] = data.arrivalTime.split(':').map(Number);
            const [endH, endM] = data.leaveTime.split(':').map(Number);
            const startMins = startH * 60 + startM;
            const endMins = endH * 60 + endM;
            hoursUsed = Math.abs(endMins - startMins) / 60;
        } else {
            // Default to 2 hours if not specified
            hoursUsed = 2;
        }

        if (cycle.remainingHours < hoursUsed) {
            throw new BadRequestException(
                `Insufficient permission hours. Available: ${cycle.remainingHours}h, Requested: ${hoursUsed}h`,
            );
        }

        // Check existing requests: max 2 per cycle (4h = once, or 2h+2h = twice)
        const existingRequests = await this.prisma.permissionRequest.count({
            where: { cycleId: cycle.id, status: { not: 'REJECTED' } },
        });

        if (existingRequests >= 2) {
            throw new BadRequestException('Maximum 2 permission requests per cycle allowed');
        }

        const request = await this.prisma.permissionRequest.create({
            data: {
                userId,
                cycleId: cycle.id,
                permissionType: data.permissionType,
                requestDate: new Date(data.requestDate),
                arrivalTime: data.arrivalTime,
                leaveTime: data.leaveTime,
                hoursUsed,
                reason: data.reason,
                status: 'PENDING',
            },
            include: { user: { include: { department: true } } },
        });

        await this.auditService.log({
            userId,
            action: 'PERMISSION_REQUESTED',
            entity: 'PermissionRequest',
            entityId: request.id,
        });

        // Notify managers
        if (request.user.departmentId) {
            const managers = await this.prisma.user.findMany({
                where: {
                    departmentId: request.user.departmentId,
                    role: { in: ['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'] },
                },
            });

            for (const mgr of managers) {
                await this.notificationsService.createInApp({
                    receiverId: mgr.id,
                    senderId: userId,
                    type: 'PERMISSION_REQUEST',
                    title: 'New Permission Request',
                    titleAr: 'طلب إذن جديد',
                    body: `${request.user.fullName} requested ${hoursUsed}h permission on ${new Date(data.requestDate).toLocaleDateString()}.`,
                    bodyAr: `طلب ${request.user.fullName} إذن ${hoursUsed} ساعة.`,
                    metadata: { permissionRequestId: request.id },
                });
            }
        }

        return request;
    }

    async findAll(userId: string, role: string) {
        const where: any = {};
        if (role === 'EMPLOYEE') where.userId = userId;
        else if (role === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: userId } });
            const employees = await this.prisma.user.findMany({ where: { departmentId: manager.departmentId }, select: { id: true } });
            where.userId = { in: employees.map((e) => e.id) };
        }

        return this.prisma.permissionRequest.findMany({
            where,
            include: { user: { select: { fullName: true, fullNameAr: true, employeeNumber: true } }, cycle: true },
            orderBy: { createdAt: 'desc' },
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

        if (role === 'MANAGER') {
            newStatus = action === 'approve' ? 'MANAGER_APPROVED' : 'REJECTED';
            updateData.managerComment = comment;
            if (action === 'approve') { updateData.approvedByMgrId = actorId; updateData.approvedByMgrAt = new Date(); }
        } else {
            newStatus = action === 'approve' ? 'HR_APPROVED' : 'REJECTED';
            updateData.hrComment = comment;
            if (action === 'approve') {
                updateData.approvedByHrId = actorId;
                updateData.approvedByHrAt = new Date();
                // Deduct from cycle
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

        // Notify employee
        await this.notificationsService.createInApp({
            receiverId: request.userId,
            type: action === 'approve' ? 'PERMISSION_APPROVED' : 'PERMISSION_REJECTED',
            title: action === 'approve' ? 'Permission Approved ✅' : 'Permission Rejected ❌',
            titleAr: action === 'approve' ? 'تمت الموافقة على الإذن ✅' : 'تم رفض الإذن ❌',
            body: comment || (action === 'approve' ? 'Your permission has been approved.' : 'Your permission has been rejected.'),
            bodyAr: comment || (action === 'approve' ? 'تمت الموافقة على طلبك.' : 'تم رفض طلبك.'),
            metadata: { permissionRequestId: id },
        });

        if (request.user.phone) {
            await this.notificationsService.sendWhatsApp(
                request.user.phone,
                `📋 SPHINX HR: Permission ${action === 'approve' ? 'Approved ✅' : 'Rejected ❌'}\n${comment || ''}`,
            );
        }

        return updated;
    }

    async updateRequest(id: string, actorId: string, role: string, data: any) {
        const request = await this.prisma.permissionRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Not found');
        if (role === 'EMPLOYEE') {
            if (request.userId !== actorId) throw new ForbiddenException();
            if (request.status !== 'PENDING') throw new BadRequestException('Can only edit pending requests');
        }

        const cycle = await this.getOrCreateCycle(request.userId);
        let hoursUsed = request.hoursUsed;
        const arrivalTime = data.arrivalTime ?? request.arrivalTime;
        const leaveTime = data.leaveTime ?? request.leaveTime;
        if (arrivalTime && leaveTime) {
            const [startH, startM] = arrivalTime.split(':').map(Number);
            const [endH, endM] = leaveTime.split(':').map(Number);
            const startMins = startH * 60 + startM;
            const endMins = endH * 60 + endM;
            hoursUsed = Math.abs(endMins - startMins) / 60;
        }
        if (cycle.remainingHours < hoursUsed) {
            throw new BadRequestException(
                `Insufficient permission hours. Available: ${cycle.remainingHours}h, Requested: ${hoursUsed}h`,
            );
        }

        const updated = await this.prisma.permissionRequest.update({
            where: { id },
            data: {
                permissionType: data.permissionType ?? request.permissionType,
                requestDate: data.requestDate ? new Date(data.requestDate) : request.requestDate,
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
        if (role === 'EMPLOYEE') {
            if (request.userId !== actorId) throw new ForbiddenException();
            if (request.status !== 'PENDING') throw new BadRequestException('Can only cancel pending requests');
        }
        await this.prisma.permissionRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
        await this.auditService.log({ userId: actorId, action: 'PERMISSION_CANCELLED', entity: 'PermissionRequest', entityId: id });
        return { message: 'Cancelled' };
    }

    async deleteRequest(id: string, actorId: string, role: string) {
        if (!(role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) throw new ForbiddenException();
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
            requestDate: request.requestDate,
            arrivalTime: request.arrivalTime,
            leaveTime: request.leaveTime,
            reason: request.reason,
        });
    }

    // Auto-reset cycles on day 11 of each month
    @Cron('0 0 11 * *')
    async resetCycles() {
        console.log('Resetting permission cycles...');
        const users = await this.prisma.user.findMany({ select: { id: true } });
        for (const user of users) {
            await this.getOrCreateCycle(user.id);
        }
    }
}
