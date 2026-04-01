import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('NotificationsService', () => {
    const prisma = {
        notification: {
            create: jest.fn(),
            createMany: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            updateMany: jest.fn(),
        },
        notificationDelivery: {
            create: jest.fn(),
            update: jest.fn(),
        },
        workScheduleSettings: {
            findFirst: jest.fn(),
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
    const emailService = {
        hasConfig: jest.fn(),
        sendEmail: jest.fn(),
    };

    let service: NotificationsService;

    beforeEach(() => {
        jest.clearAllMocks();
        prisma.notification.create.mockResolvedValue({});
        prisma.notification.createMany.mockResolvedValue({ count: 0 });
        prisma.notification.findMany.mockResolvedValue([]);
        prisma.notification.count.mockResolvedValue(0);
        prisma.notification.updateMany.mockResolvedValue({ count: 0 });
        prisma.notificationDelivery.create.mockImplementation(async ({ data }: any) => ({ id: `${data.channel}-log` }));
        prisma.notificationDelivery.update.mockResolvedValue({});
        prisma.workScheduleSettings.findFirst.mockResolvedValue({ notificationTemplates: null });
        prisma.user.findUnique.mockResolvedValue(null);
        pusher.triggerToUser.mockResolvedValue(undefined);
        whatsAppService.hasConfig.mockResolvedValue(true);
        whatsAppService.sendWhatsApp.mockResolvedValue({ ok: true, phone: '201012345678', attempts: 1 });
        emailService.hasConfig.mockReturnValue(true);
        emailService.sendEmail.mockResolvedValue({
            ok: true,
            recipient: 'employee@example.com',
            attempts: 1,
            messageId: 'message-1',
            response: '250 queued',
        });

        service = new NotificationsService(
            prisma as any,
            pusher as any,
            whatsAppService as any,
            emailService as unknown as EmailService,
        );
        (service as any).runInBackground = (task: Promise<unknown>) => task.catch(() => undefined);
    });

    it('renders account-created placeholders and logs both channels', async () => {
        const delivery = await service.sendAccountCreatedMessage({
            id: 'user-1',
            fullName: 'Sara Adel',
            email: 'employee@example.com',
            phone: '01012345678',
            employeeNumber: 'EMP-0001',
            username: 'sara.adel',
            workflowMode: 'APPROVAL_WORKFLOW',
        }, {
            temporaryPassword: 'SPHINX@2026',
            syncWhatsApp: true,
        });

        await flushPromises();

        expect(delivery).toEqual({ ok: true, phone: '201012345678', attempts: 1 });
        expect(whatsAppService.sendWhatsApp).toHaveBeenCalledWith(
            '01012345678',
            expect.stringContaining('SPHINX@2026'),
        );
        expect(whatsAppService.sendWhatsApp).toHaveBeenCalledWith(
            '01012345678',
            expect.stringContaining('sara.adel'),
        );
        expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'employee@example.com',
            subject: expect.stringContaining('Your account is ready'),
            html: expect.stringContaining('SPHINX@2026'),
        }));
        expect(prisma.notificationDelivery.create).toHaveBeenCalledTimes(2);
        expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'WHATSAPP-log' },
            data: expect.objectContaining({ status: 'SENT', attempts: 1 }),
        }));
        expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'EMAIL-log' },
            data: expect.objectContaining({ status: 'SENT', attempts: 1 }),
        }));
    });

    it('sends permission approval through both external channels and stores related request logs', async () => {
        await service.notifyPermissionAction({
            id: 'perm-1',
            userId: 'user-1',
            permissionType: 'EARLY_LEAVE',
            requestDate: '2026-04-02',
            arrivalTime: '09:00',
            leaveTime: '15:00',
            hoursUsed: 2,
            reason: 'Personal errand',
            user: {
                id: 'user-1',
                email: 'employee@example.com',
                phone: '01012345678',
                fullName: 'Mona Samir',
            },
        }, 'approved', {
            comment: 'Approved by HR',
            sendExternal: true,
        });

        await flushPromises();

        expect(whatsAppService.sendWhatsApp).toHaveBeenCalledWith(
            '01012345678',
            expect.stringContaining('Approved by HR'),
        );
        expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'employee@example.com',
            subject: expect.stringContaining('Permission Approved'),
            html: expect.stringContaining('Approved by HR'),
        }));
        expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                channel: 'EMAIL',
                workflowKey: 'permission.approved',
                templateKey: 'permissionApproved',
                relatedEntityType: 'PermissionRequest',
                relatedEntityId: 'perm-1',
            }),
        }));
        expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                channel: 'WHATSAPP',
                workflowKey: 'permission.approved',
                templateKey: 'permissionApproved',
                relatedEntityType: 'PermissionRequest',
                relatedEntityId: 'perm-1',
            }),
        }));
    });
});
