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

        expect(delivery).toEqual({
            emailDelivery: {
                ok: true,
                recipient: 'employee@example.com',
                attempts: 1,
                messageId: 'message-1',
                response: '250 queued',
            },
            whatsAppDelivery: { ok: true, phone: '201012345678', attempts: 1 },
        });
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

    it('keeps WhatsApp delivery successful when email delivery throws unexpectedly', async () => {
        emailService.sendEmail.mockRejectedValue(new Error('SMTP socket hang up'));

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
            waitForExternalDeliveries: true,
        });

        expect(delivery.whatsAppDelivery).toEqual({
            ok: true,
            phone: '201012345678',
            attempts: 1,
        });
        expect(delivery.emailDelivery).toEqual({
            ok: false,
            recipient: 'employee@example.com',
            attempts: 0,
            error: 'SMTP socket hang up',
        });
        expect(whatsAppService.sendWhatsApp).toHaveBeenCalledTimes(1);
    });

    it('keeps email delivery successful when WhatsApp delivery throws unexpectedly', async () => {
        whatsAppService.sendWhatsApp.mockRejectedValue(new Error('Evolution API unreachable'));

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
            waitForExternalDeliveries: true,
        });

        expect(delivery.emailDelivery).toEqual({
            ok: true,
            recipient: 'employee@example.com',
            attempts: 1,
            messageId: 'message-1',
            response: '250 queued',
        });
        expect(delivery.whatsAppDelivery).toEqual({
            ok: false,
            phone: '01012345678',
            attempts: 0,
            error: 'Evolution API unreachable',
        });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('returns request receipt delivery status when waiting for external deliveries', async () => {
        const delivery = await service.sendRequestReceipt({
            user: {
                id: 'user-1',
                email: 'employee@example.com',
                phone: '01012345678',
                fullName: 'Mona Samir',
            },
            requestType: 'leave',
            requestId: 'leave-receipt-1',
            requestLabelAr: 'طلب إجازة اعتيادية',
            requestLabelEn: 'Annual leave request',
            status: 'HR_APPROVED',
            requestDetails: {
                leaveType: 'ANNUAL',
                startDate: '2026-04-14',
                endDate: '2026-04-14',
                totalDays: 1,
                reason: '',
            },
            waitForExternalDeliveries: true,
        });

        expect(delivery).toEqual({
            emailDelivery: {
                ok: true,
                recipient: 'employee@example.com',
                attempts: 1,
                messageId: 'message-1',
                response: '250 queued',
            },
            whatsAppDelivery: { ok: true, phone: '201012345678', attempts: 1 },
        });
        expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                channel: 'EMAIL',
                workflowKey: 'leave.receipt',
                templateKey: 'leaveReceipt',
                relatedEntityType: 'LeaveRequest',
                relatedEntityId: 'leave-receipt-1',
            }),
        }));
        expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                channel: 'WHATSAPP',
                workflowKey: 'leave.receipt',
                templateKey: 'leaveReceipt',
                relatedEntityType: 'LeaveRequest',
                relatedEntityId: 'leave-receipt-1',
            }),
        }));
    });

    it('respects email-only notification preference for request receipts', async () => {
        prisma.user.findUnique.mockResolvedValue({ notificationDeliveryPreference: 'EMAIL_ONLY' });

        const delivery = await service.sendRequestReceipt({
            user: {
                id: 'user-1',
                email: 'employee@example.com',
                phone: '01012345678',
                fullName: 'Mona Samir',
            },
            requestType: 'leave',
            requestId: 'leave-receipt-email-only',
            requestLabelAr: 'طلب إجازة اعتيادية',
            requestLabelEn: 'Annual leave request',
            status: 'PENDING',
            requestDetails: {
                leaveType: 'ANNUAL',
                startDate: '2026-04-14',
                endDate: '2026-04-14',
                totalDays: 1,
                reason: '',
            },
            waitForExternalDeliveries: true,
        });

        expect(delivery.emailDelivery).toEqual({
            ok: true,
            recipient: 'employee@example.com',
            attempts: 1,
            messageId: 'message-1',
            response: '250 queued',
        });
        expect(delivery.whatsAppDelivery).toBeNull();
        expect(whatsAppService.sendWhatsApp).not.toHaveBeenCalled();
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('respects WhatsApp-only notification preference for request receipts', async () => {
        prisma.user.findUnique.mockResolvedValue({ notificationDeliveryPreference: 'WHATSAPP_ONLY' });

        const delivery = await service.sendRequestReceipt({
            user: {
                id: 'user-1',
                email: 'employee@example.com',
                phone: '01012345678',
                fullName: 'Mona Samir',
            },
            requestType: 'permission',
            requestId: 'permission-receipt-wa-only',
            requestLabelAr: 'طلب إذن شخصي',
            requestLabelEn: 'Personal permission request',
            status: 'PENDING',
            requestDetails: {
                permissionType: 'PERSONAL',
                requestDate: '2026-04-14',
                arrivalTime: '09:00',
                leaveTime: '11:00',
                hoursUsed: 2,
                reason: '',
            },
            waitForExternalDeliveries: true,
        });

        expect(delivery.whatsAppDelivery).toEqual({
            ok: true,
            phone: '201012345678',
            attempts: 1,
        });
        expect(delivery.emailDelivery).toBeNull();
        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(whatsAppService.sendWhatsApp).toHaveBeenCalledTimes(1);
    });

    it('formats permission duration as hours and minutes without decimal values', () => {
        expect((service as any).formatHours(1.5, 'ar')).toBe('١ ساعة و٣٠ دقائق');
        expect((service as any).formatHours(2, 'ar')).toBe('٢ ساعات');
        expect((service as any).formatHours(0.5, 'ar')).toBe('٣٠ دقائق');
        expect((service as any).formatHours(1.5, 'en')).toBe('1 hour and 30 minutes');
        expect((service as any).formatHours(2, 'en')).toBe('2 hours');
        expect((service as any).formatHours(0.5, 'en')).toBe('30 minutes');
    });

    it('emits a realtime refresh after marking notifications as read', async () => {
        await service.markAllRead('user-1');
        await flushPromises();

        expect(prisma.notification.updateMany).toHaveBeenCalledWith({
            where: { receiverId: 'user-1' },
            data: { isRead: true },
        });
        expect(pusher.triggerToUser).toHaveBeenCalledWith(
            'user-1',
            'notification',
            expect.objectContaining({ type: 'NOTIFICATION_COUNTERS_UPDATED' }),
        );
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

    it('sends leave submission through both external channels using the preloaded request user', async () => {
        await service.notifyLeaveAction({
            id: 'leave-1',
            userId: 'user-1',
            leaveType: 'ANNUAL',
            startDate: new Date('2026-04-02T00:00:00.000Z'),
            endDate: new Date('2026-04-03T00:00:00.000Z'),
            totalDays: 2,
            reason: 'Family trip',
            user: {
                id: 'user-1',
                email: 'employee@example.com',
                phone: '01012345678',
                fullName: 'Mona Samir',
            },
        }, 'submitted');

        await flushPromises();

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            select: { notificationDeliveryPreference: true },
        });
        expect(whatsAppService.sendWhatsApp).toHaveBeenCalledWith(
            '01012345678',
            expect.stringContaining('Under review'),
        );
        expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'employee@example.com',
            subject: expect.stringContaining('Leave Request Submitted'),
        }));
        expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                channel: 'EMAIL',
                workflowKey: 'leave.submitted',
                templateKey: 'leaveSubmitted',
                relatedEntityType: 'LeaveRequest',
                relatedEntityId: 'leave-1',
            }),
        }));
        expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                channel: 'WHATSAPP',
                workflowKey: 'leave.submitted',
                templateKey: 'leaveSubmitted',
                relatedEntityType: 'LeaveRequest',
                relatedEntityId: 'leave-1',
            }),
        }));
    });

    it('sends permission verification through both external channels by default', async () => {
        await service.notifyPermissionAction({
            id: 'perm-2',
            userId: 'user-2',
            permissionType: 'PERSONAL',
            requestDate: '2026-04-03',
            arrivalTime: '09:00',
            leaveTime: '11:00',
            hoursUsed: 2,
            reason: 'Follow-up',
            user: {
                id: 'user-2',
                email: 'employee@example.com',
                phone: '01012345678',
                fullName: 'Mona Samir',
            },
        }, 'verified');

        await flushPromises();

        expect(whatsAppService.sendWhatsApp).toHaveBeenCalledWith(
            '01012345678',
            expect.stringContaining('Verified'),
        );
        expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'employee@example.com',
            subject: expect.stringContaining('Permission Request Verified'),
        }));
    });

    it('sends form approval through both external channels', async () => {
        await service.notifyFormAction({
            id: 'form-sub-1',
            userId: 'user-3',
            createdAt: '2026-04-04T09:00:00.000Z',
            form: {
                id: 'form-1',
                name: 'Vacation Settlement',
                nameAr: 'تسوية إجازة',
            },
            user: {
                id: 'user-3',
                email: 'employee@example.com',
                phone: '01012345678',
                fullName: 'Mona Samir',
            },
        }, 'approved', {
            comment: 'Approved by HR',
        });

        await flushPromises();

        expect(whatsAppService.sendWhatsApp).toHaveBeenCalledWith(
            '01012345678',
            expect.stringContaining('Vacation Settlement'),
        );
        expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'employee@example.com',
            subject: expect.stringContaining('Form Approved'),
            html: expect.stringContaining('Approved by HR'),
        }));
        expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                channel: 'EMAIL',
                workflowKey: 'form.approved',
                relatedEntityType: 'FormSubmission',
                relatedEntityId: 'form-sub-1',
            }),
        }));
    });
});
