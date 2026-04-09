import { BadRequestException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
    const prisma = {
        $transaction: jest.fn(),
        leaveRequest: {
            findFirst: jest.fn(),
        },
        permissionCycle: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        permissionRequest: {
            aggregate: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        lateness: {
            updateMany: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
        workScheduleSettings: {
            findFirst: jest.fn(),
        },
    };
    const notificationsService = {
        emitRealtimeToUsers: jest.fn(),
        sendRequestReceipt: jest.fn(),
        notifyPermissionAction: jest.fn(),
        createInApp: jest.fn(),
        createInAppBulk: jest.fn(),
    };
    const auditService = {
        log: jest.fn(),
    };

    let service: PermissionsService;

    beforeEach(() => {
        jest.clearAllMocks();
        prisma.$transaction.mockImplementation(async (callback: any) => callback({
            lateness: prisma.lateness,
            permissionRequest: prisma.permissionRequest,
        }));
        prisma.permissionCycle.create.mockResolvedValue({
            id: 'cycle-created',
            userId: 'user-1',
            cycleStart: new Date('2026-04-11T00:00:00.000Z'),
            cycleEnd: new Date('2026-05-10T00:00:00.000Z'),
            totalHours: 4,
            usedHours: 0,
            remainingHours: 4,
        });
        prisma.permissionCycle.update.mockResolvedValue({});
        prisma.permissionRequest.create.mockResolvedValue({});
        prisma.permissionRequest.update.mockResolvedValue({});
        prisma.permissionRequest.delete.mockResolvedValue({});
        prisma.permissionRequest.count.mockResolvedValue(0);
        prisma.leaveRequest.findFirst.mockResolvedValue(null);
        prisma.permissionRequest.findFirst.mockResolvedValue(null);
        prisma.lateness.updateMany.mockResolvedValue({ count: 0 });
        prisma.user.findMany.mockResolvedValue([]);
        prisma.workScheduleSettings.findFirst.mockResolvedValue(null);
        notificationsService.emitRealtimeToUsers.mockResolvedValue(undefined);
        notificationsService.sendRequestReceipt.mockResolvedValue({
            emailDelivery: null,
            whatsAppDelivery: null,
        });
        notificationsService.notifyPermissionAction.mockResolvedValue(undefined);
        notificationsService.createInApp.mockResolvedValue(undefined);
        notificationsService.createInAppBulk.mockResolvedValue(undefined);
        auditService.log.mockResolvedValue(undefined);

        service = new PermissionsService(prisma as any, notificationsService as any, auditService as any);
    });

    it('returns a live cycle snapshot using reserved hours for remaining balance', async () => {
        prisma.permissionCycle.findUnique.mockResolvedValue({
            id: 'cycle-1',
            userId: 'user-1',
            cycleStart: new Date('2026-04-11T00:00:00.000Z'),
            cycleEnd: new Date('2026-05-10T00:00:00.000Z'),
            totalHours: 6,
            usedHours: 0,
            remainingHours: 6,
        });
        prisma.permissionRequest.aggregate
            .mockResolvedValueOnce({ _sum: { hoursUsed: 2.5 } })
            .mockResolvedValueOnce({ _sum: { hoursUsed: 1.5 } });

        const cycle = await service.getCurrentCycle('user-1');

        expect(cycle).toMatchObject({
            id: 'cycle-1',
            totalHours: 6,
            reservedHours: 2.5,
            approvedHours: 1.5,
            usedHours: 1.5,
            remainingHours: 3.5,
        });
        expect(prisma.permissionRequest.aggregate).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: expect.objectContaining({
                cycleId: 'cycle-1',
                status: { in: ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED'] },
            }),
        }));
        expect(prisma.permissionRequest.aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: expect.objectContaining({
                cycleId: 'cycle-1',
                status: 'HR_APPROVED',
            }),
        }));
    });

    it('blocks creating another permission when cycle hours are exhausted', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            workflowMode: 'APPROVAL_WORKFLOW',
        });
        prisma.permissionCycle.findUnique.mockResolvedValue({
            id: 'cycle-1',
            userId: 'user-1',
            cycleStart: new Date('2026-04-11T00:00:00.000Z'),
            cycleEnd: new Date('2026-05-10T00:00:00.000Z'),
            totalHours: 4,
            usedHours: 4,
            remainingHours: 0,
        });
        prisma.permissionRequest.aggregate.mockResolvedValue({ _sum: { hoursUsed: 4 } });

        await expect(service.createRequest('user-1', {
            permissionType: 'LATE_ARRIVAL',
            requestDate: '2026-04-14',
            permissionScope: 'ARRIVAL',
            durationMinutes: 60,
            reason: '',
        } as any)).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.permissionRequest.create).not.toHaveBeenCalled();
    });

    it('accepts a request when available and requested values are equal after minute rounding', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            workflowMode: 'APPROVAL_WORKFLOW',
        });
        prisma.permissionCycle.findUnique.mockResolvedValue({
            id: 'cycle-1',
            userId: 'user-1',
            cycleStart: new Date('2026-04-11T00:00:00.000Z'),
            cycleEnd: new Date('2026-05-10T00:00:00.000Z'),
            totalHours: 4,
            usedHours: 0,
            remainingHours: 0.33333333333333304,
        });
        prisma.permissionRequest.aggregate
            .mockResolvedValueOnce({ _sum: { hoursUsed: 3.666666666666667 } })
            .mockResolvedValueOnce({ _sum: { hoursUsed: 0 } });
        prisma.permissionRequest.create.mockResolvedValue({
            id: 'perm-precision',
            permissionType: 'LATE_ARRIVAL',
            requestDate: new Date('2026-04-14T00:00:00.000Z'),
            arrivalTime: '09:20',
            leaveTime: '17:00',
            hoursUsed: 0.3333333333333333,
            reason: '',
            status: 'PENDING',
            userId: 'user-1',
            user: {
                id: 'user-1',
                fullName: 'Test User',
                department: null,
                governorate: null,
                employeeNumber: 'EMP-1',
            },
        });

        await expect(service.createRequest('user-1', {
            permissionType: 'LATE_ARRIVAL',
            requestDate: '2026-04-14',
            permissionScope: 'ARRIVAL',
            durationMinutes: 20,
            reason: '',
        } as any)).resolves.toBeTruthy();

        expect(prisma.permissionRequest.create).toHaveBeenCalled();
    });

    it('blocks creating a third permission request in the same cycle even when hours are still available', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            workflowMode: 'APPROVAL_WORKFLOW',
        });
        prisma.permissionCycle.findUnique.mockResolvedValue({
            id: 'cycle-1',
            userId: 'user-1',
            cycleStart: new Date('2026-03-11T00:00:00.000Z'),
            cycleEnd: new Date('2026-04-10T00:00:00.000Z'),
            totalHours: 4,
            usedHours: 1,
            remainingHours: 3,
        });
        prisma.permissionRequest.count.mockResolvedValue(2);
        prisma.permissionRequest.aggregate.mockResolvedValue({ _sum: { hoursUsed: 1 } });

        await expect(service.createRequest('user-1', {
            permissionType: 'LATE_ARRIVAL',
            requestDate: '2026-04-08',
            permissionScope: 'ARRIVAL',
            durationMinutes: 60,
            reason: '',
        } as any)).rejects.toThrow('You have already used your 2 permission requests for this cycle');

        expect(prisma.permissionRequest.create).not.toHaveBeenCalled();
    });


    it('uses saturday schedule for early leave scope', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            workflowMode: 'APPROVAL_WORKFLOW',
        });
        prisma.permissionCycle.findUnique.mockResolvedValue({
            id: 'cycle-1',
            userId: 'user-1',
            cycleStart: new Date('2026-03-11T00:00:00.000Z'),
            cycleEnd: new Date('2026-04-10T00:00:00.000Z'),
            totalHours: 4,
            usedHours: 0,
            remainingHours: 4,
        });
        prisma.permissionRequest.aggregate
            .mockResolvedValueOnce({ _sum: { hoursUsed: 0 } })
            .mockResolvedValueOnce({ _sum: { hoursUsed: 0 } });
        prisma.workScheduleSettings.findFirst.mockResolvedValue({
            activeMode: 'NORMAL',
            weekdayStart: '09:00',
            weekdayEnd: '17:00',
            saturdayStart: '09:00',
            saturdayEnd: '13:30',
            ramadanStart: '09:00',
            ramadanEnd: '14:30',
            ramadanStartDate: null,
            ramadanEndDate: null,
        });
        prisma.permissionRequest.create.mockResolvedValue({
            id: 'perm-2',
            permissionType: 'EARLY_LEAVE',
            requestDate: new Date('2026-04-04T00:00:00.000Z'),
            arrivalTime: '09:00',
            leaveTime: '12:30',
            hoursUsed: 1,
            reason: '',
            status: 'PENDING',
            userId: 'user-1',
            user: {
                id: 'user-1',
                fullName: 'Test User',
                governorate: null,
                departmentId: null,
            },
        });

        await service.createRequest('user-1', {
            permissionType: 'EARLY_LEAVE',
            requestDate: '2026-04-04',
            permissionScope: 'DEPARTURE',
            durationMinutes: 60,
            reason: '',
        } as any);

        expect(prisma.permissionRequest.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                arrivalTime: '09:00',
                leaveTime: '12:30',
                permissionType: 'EARLY_LEAVE',
            }),
        }));
    });

    it('blocks updating a request into a cycle that already has two other permission requests', async () => {
        prisma.permissionRequest.findUnique.mockResolvedValue({
            id: 'perm-1',
            userId: 'user-1',
            cycleId: 'cycle-old',
            status: 'PENDING',
            requestDate: new Date('2026-04-04T00:00:00.000Z'),
            permissionType: 'LATE_ARRIVAL',
            arrivalTime: '10:00',
            leaveTime: '17:00',
            reason: '',
        });
        prisma.permissionCycle.findUnique.mockResolvedValue({
            id: 'cycle-1',
            userId: 'user-1',
            cycleStart: new Date('2026-04-11T00:00:00.000Z'),
            cycleEnd: new Date('2026-05-10T00:00:00.000Z'),
            totalHours: 4,
            usedHours: 2,
            remainingHours: 2,
        });
        prisma.permissionRequest.count.mockResolvedValue(2);
        prisma.permissionRequest.aggregate.mockResolvedValue({ _sum: { hoursUsed: 1 } });

        await expect(service.updateRequest('perm-1', 'user-1', 'EMPLOYEE', {
            requestDate: '2026-04-14',
            permissionScope: 'ARRIVAL',
            durationMinutes: 60,
        } as any)).rejects.toThrow('You have already used your 2 permission requests for this cycle');

        expect(prisma.permissionRequest.update).not.toHaveBeenCalled();
    });

    it('allows a sandbox employee to delete their own permission and re-syncs cycle state', async () => {
        prisma.permissionRequest.findUnique.mockResolvedValue({
            id: 'perm-1',
            userId: 'user-1',
            cycleId: 'cycle-1',
            status: 'HR_APPROVED',
            hoursUsed: 2,
            requestDate: new Date('2026-04-14T00:00:00.000Z'),
            user: {
                governorate: null,
                departmentId: null,
            },
        });
        prisma.user.findUnique.mockResolvedValue({
            workflowMode: 'SANDBOX',
        });
        prisma.permissionCycle.findUnique.mockResolvedValue({
            id: 'cycle-1',
            userId: 'user-1',
            cycleStart: new Date('2026-04-11T00:00:00.000Z'),
            cycleEnd: new Date('2026-05-10T00:00:00.000Z'),
            totalHours: 4,
            usedHours: 2,
            remainingHours: 2,
        });
        prisma.permissionRequest.aggregate
            .mockResolvedValueOnce({ _sum: { hoursUsed: 0 } })
            .mockResolvedValueOnce({ _sum: { hoursUsed: 0 } });

        const result = await service.deleteRequest('perm-1', 'user-1', 'EMPLOYEE');

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(prisma.lateness.updateMany).toHaveBeenCalledWith({
            where: { permissionId: 'perm-1' },
            data: {
                convertedToPermission: false,
                permissionId: null,
            },
        });
        expect(prisma.permissionRequest.delete).toHaveBeenCalledWith({ where: { id: 'perm-1' } });
        expect(prisma.permissionCycle.update).toHaveBeenCalledWith({
            where: { id: 'cycle-1' },
            data: {
                usedHours: 0,
                remainingHours: 4,
            },
        });
        expect(notificationsService.emitRealtimeToUsers).toHaveBeenCalledWith(
            ['user-1'],
            expect.objectContaining({
                type: 'REQUEST_UPDATED',
                requestType: 'permission',
                requestId: 'perm-1',
            }),
        );
        expect(result).toEqual({ message: 'Deleted' });
    });
});
