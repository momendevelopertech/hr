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
import { addMonths, setDate, startOfDay } from 'date-fns';

@Injectable()
export class PermissionsService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
        private auditService: AuditService,
    ) { }

    // Permission cycle: day 11 to day 10 next month.
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
        permissionScope?: 'ARRIVAL' | 'DEPARTURE';
        durationMinutes?: number;
        reason?: string;
    }) {
        const cycle = await this.getOrCreateCycle(userId);

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
                userId,
                cycleId: cycle.id,
                permissionType,
                requestDate: new Date(data.requestDate),
                arrivalTime,
                leaveTime,
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
                    titleAr: 'New Permission Request',
                    body: `${request.user.fullName} requested ${hoursUsed}h permission on ${new Date(data.requestDate).toLocaleDateString()}.`,
                    bodyAr: `${request.user.fullName} requested ${hoursUsed}h permission.`,
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
        } else if (role === 'BRANCH_SECRETARY') {
            const secretary = await this.prisma.user.findUnique({ where: { id: userId } });
            if (secretary?.governorate) {
                const employees = await this.prisma.user.findMany({ where: { governorate: secretary.governorate }, select: { id: true } });
                where.userId = { in: employees.map((e) => e.id) };
            }
        }
        if (!where.userId && !(role === 'HR_ADMIN' || role === 'SUPER_ADMIN')) {
            where.userId = userId;
        }

        return this.prisma.permissionRequest.findMany({
            where,
            include: { user: { select: { fullName: true, fullNameAr: true, employeeNumber: true } }, cycle: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.permissionRequest.findUnique({
            where: { id },
            include: {
                user: { select: { fullName: true, fullNameAr: true, employeeNumber: true } },
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

        if (role === 'MANAGER') {
            newStatus = action === 'approve' ? 'MANAGER_APPROVED' : 'REJECTED';
            updateData.managerComment = comment;
            if (action === 'approve') {
                updateData.approvedByMgrId = actorId;
                updateData.approvedByMgrAt = new Date();
            }
        } else {
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

        await this.notificationsService.createInApp({
            receiverId: request.userId,
            type: action === 'approve' ? 'PERMISSION_APPROVED' : 'PERMISSION_REJECTED',
            title: action === 'approve' ? 'Permission Approved' : 'Permission Rejected',
            titleAr: action === 'approve' ? 'Permission Approved' : 'Permission Rejected',
            body: comment || (action === 'approve' ? 'Your permission has been approved.' : 'Your permission has been rejected.'),
            bodyAr: comment || (action === 'approve' ? 'Your permission has been approved.' : 'Your permission has been rejected.'),
            metadata: { permissionRequestId: id },
        });

        if (request.user.phone) {
            await this.notificationsService.sendWhatsApp(
                request.user.phone,
                `SPHINX HR: Permission ${action === 'approve' ? 'Approved' : 'Rejected'}\n${comment || ''}`,
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
        if (request.userId !== actorId) throw new ForbiddenException('Only request owner can cancel');
        if (request.status !== 'PENDING') throw new BadRequestException('Can only cancel pending requests');
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

    @Cron('0 0 11 * *')
    async resetCycles() {
        const users = await this.prisma.user.findMany({ select: { id: true } });
        for (const user of users) {
            await this.getOrCreateCycle(user.id);
        }
    }
}
