import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
    const prisma = {
        notification: {
            create: jest.fn(),
            createMany: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            updateMany: jest.fn(),
        },
        user: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
    };
    const pusher = {
        triggerToUser: jest.fn(),
    };
    const whatsAppService = {
        hasConfig: jest.fn(),
        sendWhatsApp: jest.fn(),
    };

    let service: NotificationsService;

    beforeEach(() => {
        jest.clearAllMocks();
        prisma.notification.create.mockResolvedValue({});
        pusher.triggerToUser.mockResolvedValue(undefined);
        whatsAppService.sendWhatsApp.mockResolvedValue({ ok: true, phone: '201012345678' });
        service = new NotificationsService(prisma as any, pusher as any, whatsAppService as any);
        jest.spyOn(service, 'sendEmail').mockResolvedValue(undefined);
    });

    it('builds a rich Arabic leave receipt with name, details, and link', async () => {
        await service.sendRequestReceipt({
            user: {
                email: 'ahmed@example.com',
                phone: '01012345678',
                fullName: 'Ahmed Ali',
                fullNameAr: 'أحمد علي',
            },
            requestType: 'leave',
            requestId: 'leave-1',
            requestLabelAr: 'طلب غياب بإذن',
            requestLabelEn: 'absence with permission request',
            status: 'PENDING',
            requestDetails: {
                leaveType: 'ABSENCE_WITH_PERMISSION',
                startDate: '2026-04-01',
                endDate: '2026-04-01',
                totalDays: 1,
                reason: 'ظرف عائلي',
            },
        });

        const sentMessage = whatsAppService.sendWhatsApp.mock.calls[0][1];
        expect(sentMessage).toContain('عزيزي أحمد علي');
        expect(sentMessage).toContain('غياب بإذن');
        expect(sentMessage).toContain('ظرف عائلي');
        expect(sentMessage).toContain('تم تسجيل الطلب وهو قيد المراجعة');
        expect(sentMessage).toContain('/ar/requests/print/leave/leave-1');
        expect(sentMessage).toContain(new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date('2026-04-01')));
    });

    it('includes password and login link in the account-created WhatsApp template', async () => {
        const delivery = await service.sendAccountCreatedMessage({
            fullName: 'Sara Adel',
            fullNameAr: 'سارة عادل',
            email: 'sara@example.com',
            phone: '01012345678',
            employeeNumber: 'EMP-0001',
            username: 'sara1234',
            workflowMode: 'APPROVAL_WORKFLOW',
        }, {
            temporaryPassword: 'SPHINX@2026',
            syncWhatsApp: true,
        });

        const sentMessage = whatsAppService.sendWhatsApp.mock.calls[0][1];
        expect(delivery).toEqual({ ok: true, phone: '201012345678' });
        expect(sentMessage).toContain('عزيزي سارة عادل');
        expect(sentMessage).toContain('sara1234');
        expect(sentMessage).toContain('SPHINX@2026');
        expect(sentMessage).toContain('سير الموافقات');
        expect(sentMessage).toContain('/ar');
    });

    it('adds permission details and manager comment to the WhatsApp approval flow', async () => {
        await service.notifyPermissionAction({
            id: 'perm-1',
            userId: 'user-1',
            permissionType: 'EARLY_LEAVE',
            requestDate: '2026-04-02',
            arrivalTime: '09:00',
            leaveTime: '15:00',
            hoursUsed: 2,
            reason: 'مراجعة شخصية',
            user: {
                id: 'user-1',
                email: 'mona@example.com',
                phone: '01012345678',
                fullName: 'Mona',
                fullNameAr: 'منى',
            },
        }, 'approved', {
            comment: 'تمت الموافقة من المدير',
            sendExternal: true,
        });

        const sentMessage = whatsAppService.sendWhatsApp.mock.calls[0][1];
        expect(sentMessage).toContain('عزيزي منى');
        expect(sentMessage).toContain('إذن انصراف مبكر');
        expect(sentMessage).toContain('09:00 - 15:00');
        expect(sentMessage).toContain('تمت الموافقة من المدير');
        expect(sentMessage).toContain('/ar/requests/print/permission/perm-1');
    });
});
