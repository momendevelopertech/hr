import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
    const prisma = {
        permissionCycle: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        permissionRequest: {
            aggregate: jest.fn(),
        },
    };
    const notificationsService = {
        emitRealtimeToUsers: jest.fn(),
    };
    const auditService = {
        log: jest.fn(),
    };

    let service: PermissionsService;

    beforeEach(() => {
        jest.clearAllMocks();
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
});
