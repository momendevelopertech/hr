import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { endOfDay, startOfDay } from 'date-fns';
import { PusherService } from '../pusher/pusher.service';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { formatEgyptMobileForWhatsApp } from '../shared/egypt-phone';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private transporter: nodemailer.Transporter;

    constructor(
        private prisma: PrismaService,
        private pusher: PusherService,
    ) {
        this.transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: parseInt(process.env.MAIL_PORT || '587', 10),
            secure: false,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });
    }

    private async getWhatsAppConfig() {
        const envToken = process.env.WHAPI_TOKEN?.trim();
        const envBaseUrl = process.env.WHAPI_BASE_URL?.trim() || 'https://gate.whapi.cloud/';

        try {
            const settings = await this.prisma.workScheduleSettings.findFirst({
                select: { whapiToken: true, whapiBaseUrl: true },
            });
            const token = settings?.whapiToken?.trim() || envToken;
            const baseUrl = settings?.whapiBaseUrl?.trim() || envBaseUrl;
            return token ? { token, baseUrl } : null;
        } catch (error: any) {
            if (error?.code !== 'P2022') {
                throw error;
            }
            return envToken ? { token: envToken, baseUrl: envBaseUrl } : null;
        }
    }

    private normalizeWhatsAppPhone(phone?: string | null) {
        return formatEgyptMobileForWhatsApp(phone);
    }

    private getPublicAppUrl(locale = 'ar') {
        const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
        return `${baseUrl}/${locale}`;
    }

    private getPreferredLocale(user?: { fullNameAr?: string | null }) {
        return user?.fullNameAr ? 'ar' : 'en';
    }

    private buildRequestPrintUrl(
        requestType: 'leave' | 'permission',
        requestId: string,
        locale = 'ar',
    ) {
        return `${this.getPublicAppUrl(locale)}/requests/print/${requestType}/${requestId}`;
    }

    async createInApp(data: {
        receiverId: string;
        senderId?: string;
        type: any;
        title: string;
        titleAr: string;
        body: string;
        bodyAr: string;
        metadata?: any;
    }) {
        const notification = await this.prisma.notification.create({ data });
        this.runInBackground(
            this.pusher.triggerToUser(data.receiverId, 'notification', notification),
            'Failed to send realtime notification',
        );
        return notification;
    }

    async createInAppBulk(items: Array<{
        receiverId: string;
        senderId?: string;
        type: any;
        title: string;
        titleAr: string;
        body: string;
        bodyAr: string;
        metadata?: any;
    }>) {
        if (!items.length) return;

        await this.prisma.notification.createMany({ data: items });
        this.runInBackground(
            Promise.allSettled(items.map((item) => this.pusher.triggerToUser(item.receiverId, 'notification', { type: item.type }))).then(() => undefined),
            'Failed to send realtime bulk notifications',
        );
    }

    async emitRealtimeToUsers(userIds: string[], payload: Record<string, any> = { type: 'REQUEST_UPDATED' }) {
        const unique = Array.from(new Set(userIds.filter(Boolean)));
        if (unique.length === 0) return;
        this.runInBackground(
            Promise.allSettled(unique.map((userId) => this.pusher.triggerToUser(userId, 'notification', payload))).then(() => undefined),
            'Failed to emit realtime updates',
        );
    }

    async broadcastToUsers(data: {
        senderId?: string;
        type: any;
        title: string;
        titleAr: string;
        body: string;
        bodyAr: string;
        metadata?: any;
        userIds?: string[];
        departmentId?: string;
        governorate?: string;
    }) {
        const where: any = { isActive: true };
        if (data.userIds?.length) where.id = { in: data.userIds };
        if (data.departmentId) where.departmentId = data.departmentId;
        if (data.governorate) where.governorate = data.governorate as any;

        const users = await this.prisma.user.findMany({ where, select: { id: true } });
        if (users.length === 0) return { sent: 0 };

        await this.prisma.notification.createMany({
            data: users.map((user) => ({
                receiverId: user.id,
                senderId: data.senderId,
                type: data.type,
                title: data.title,
                titleAr: data.titleAr,
                body: data.body,
                bodyAr: data.bodyAr,
                metadata: data.metadata,
            })),
        });

        this.runInBackground(
            Promise.allSettled(users.map((user) => this.pusher.triggerToUser(user.id, 'notification', { type: data.type }))).then(() => undefined),
            'Failed to broadcast realtime notifications',
        );
        return { sent: users.length };
    }

    async broadcastToAll(data: {
        senderId?: string;
        type: any;
        title: string;
        titleAr: string;
        body: string;
        bodyAr: string;
        metadata?: any;
    }) {
        return this.broadcastToUsers(data);
    }

    async getUnread(userId: string) {
        return this.prisma.notification.findMany({
            where: { receiverId: userId, isRead: false },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }

    async getAll(userId: string, params?: {
        page?: number;
        limit?: number;
        type?: string;
        status?: string;
        search?: string;
        from?: string;
        to?: string;
    }) {
        const page = Math.max(1, params?.page || 1);
        const limit = Math.min(100, Math.max(1, params?.limit || 20));
        const skip = (page - 1) * limit;

        const where: any = {
            receiverId: userId,
            ...(params?.type ? { type: params.type as any } : {}),
            ...(params?.status === 'read'
                ? { isRead: true }
                : params?.status === 'unread'
                    ? { isRead: false }
                    : {}),
            ...(params?.search
                ? {
                    OR: [
                        { title: { contains: params.search, mode: 'insensitive' } },
                        { titleAr: { contains: params.search, mode: 'insensitive' } },
                        { body: { contains: params.search, mode: 'insensitive' } },
                        { bodyAr: { contains: params.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
            ...(params?.from || params?.to
                ? (() => {
                    const fromDate = params?.from ? startOfDay(new Date(params.from)) : undefined;
                    const toDate = params?.to ? endOfDay(new Date(params.to)) : undefined;
                    return {
                        createdAt: {
                            ...(fromDate ? { gte: fromDate } : {}),
                            ...(toDate ? { lte: toDate } : {}),
                        },
                    };
                })()
                : {}),
        };

        const [items, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where }),
        ]);

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }

    async markRead(id: string, userId: string) {
        return this.prisma.notification.updateMany({
            where: { id, receiverId: userId },
            data: { isRead: true },
        });
    }

    async markAllRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { receiverId: userId },
            data: { isRead: true },
        });
    }

    async markAllReadByType(userId: string, type: string) {
        return this.prisma.notification.updateMany({
            where: { receiverId: userId, type: type as any },
            data: { isRead: true },
        });
    }

    async sendWhatsApp(phone: string, message: string) {
        if (!phone) {
            this.logger.warn('WhatsApp phone is missing');
            return;
        }

        const config = await this.getWhatsAppConfig();
        if (!config) {
            this.logger.warn('WhatsApp not configured or phone missing');
            return;
        }

        try {
            const formattedPhone = this.normalizeWhatsAppPhone(phone);
            if (!formattedPhone) {
                this.logger.warn('WhatsApp phone is invalid');
                return;
            }
            const baseUrl = config.baseUrl.replace(/\/?$/, '/');
            await axios.post(
                `${baseUrl}messages/text`,
                { to: `${formattedPhone}@s.whatsapp.net`, body: message },
                {
                    headers: {
                        Authorization: `Bearer ${config.token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            this.logger.log(`WhatsApp sent to ${formattedPhone}`);
        } catch (err: any) {
            this.logger.error(`WhatsApp send failed: ${err.message}`);
        }
    }

    async sendAccountCreatedMessage(user: {
        fullName: string;
        fullNameAr?: string | null;
        email: string;
        phone?: string | null;
        employeeNumber?: string | null;
        username?: string | null;
        workflowMode?: string | null;
    }) {
        const locale = this.getPreferredLocale(user);
        const loginUrl = this.getPublicAppUrl(locale);
        const isArabic = locale === 'ar';
        const message = isArabic
            ? `تم إنشاء حسابك في SPHINX HR بنجاح.\nرقم الموظف: ${user.employeeNumber || '-'}\nاسم المستخدم: ${user.username || user.email}\nوضع الطلبات الحالي: ${user.workflowMode === 'SANDBOX' ? 'وضع التجربة' : 'سير الموافقات'}\nرابط الدخول: ${loginUrl}`
            : `Welcome to SPHINX HR.\nEmployee #: ${user.employeeNumber || '-'}\nUsername: ${user.username || user.email}\nCurrent request mode: ${user.workflowMode === 'SANDBOX' ? 'Sandbox Mode' : 'Approval Workflow'}\nLogin: ${loginUrl}`;

        const emailSubject = isArabic ? 'تم إنشاء حسابك على SPHINX HR' : 'Your SPHINX HR account is ready';
        const emailBody = isArabic
            ? `<div style="font-family:sans-serif;max-width:600px"><h2>تم إنشاء حسابك بنجاح</h2><p>رقم الموظف: ${user.employeeNumber || '-'}</p><p>اسم المستخدم: ${user.username || user.email}</p><p>وضع الطلبات الحالي: ${user.workflowMode === 'SANDBOX' ? 'وضع التجربة' : 'سير الموافقات'}</p><p><a href="${loginUrl}">الدخول إلى النظام</a></p></div>`
            : `<div style="font-family:sans-serif;max-width:600px"><h2>Your account is ready</h2><p>Employee #: ${user.employeeNumber || '-'}</p><p>Username: ${user.username || user.email}</p><p>Request mode: ${user.workflowMode === 'SANDBOX' ? 'Sandbox Mode' : 'Approval Workflow'}</p><p><a href="${loginUrl}">Open SPHINX HR</a></p></div>`;

        const jobs: Promise<unknown>[] = [];
        if (user.phone) {
            jobs.push(this.sendWhatsApp(user.phone, message));
        }
        if (user.email) {
            jobs.push(this.sendEmail({
                to: user.email,
                subject: emailSubject,
                html: emailBody,
            }));
        }

        if (jobs.length) {
            this.runInBackground(Promise.allSettled(jobs), 'Deferred account-created notification failed');
        }
    }

    async sendPasswordResetCode(options: {
        user: { id: string; email: string; phone?: string | null; fullName?: string | null; fullNameAr?: string | null };
        code: string;
        locale?: string;
        channel: 'EMAIL' | 'WHATSAPP';
    }) {
        const locale = options.locale === 'en' ? 'en' : 'ar';
        const resetUrl = `${this.getPublicAppUrl(locale)}/reset-password`;
        const isArabic = locale === 'ar';
        const message = isArabic
            ? `رمز إعادة تعيين كلمة المرور في SPHINX HR هو: ${options.code}\nصلاحية الرمز: 10 دقائق.\nصفحة التعيين: ${resetUrl}`
            : `Your SPHINX HR password reset code is: ${options.code}\nThis code expires in 10 minutes.\nReset page: ${resetUrl}`;

        if (options.channel === 'WHATSAPP' && options.user.phone) {
            await this.sendWhatsApp(options.user.phone, message);
            return;
        }

        await this.sendEmail({
            to: options.user.email,
            subject: isArabic ? 'رمز إعادة تعيين كلمة المرور' : 'Password reset code',
            html: isArabic
                ? `<div style="font-family:sans-serif;max-width:600px"><h2>رمز إعادة التعيين</h2><p>رمز التحقق: <strong>${options.code}</strong></p><p>صلاحية الرمز 10 دقائق.</p><p><a href="${resetUrl}">افتح صفحة إعادة التعيين</a></p></div>`
                : `<div style="font-family:sans-serif;max-width:600px"><h2>Password reset code</h2><p>Your verification code is <strong>${options.code}</strong>.</p><p>The code expires in 10 minutes.</p><p><a href="${resetUrl}">Open reset page</a></p></div>`,
        });
    }

    async sendRequestReceipt(options: {
        user: {
            email: string;
            phone?: string | null;
            fullName?: string | null;
            fullNameAr?: string | null;
        };
        requestType: 'leave' | 'permission';
        requestId: string;
        requestLabelAr: string;
        requestLabelEn: string;
        status: 'PENDING' | 'HR_APPROVED';
    }) {
        const locale = this.getPreferredLocale(options.user);
        const printUrl = this.buildRequestPrintUrl(options.requestType, options.requestId, locale);
        const isArabic = locale === 'ar';
        const statusLabel = options.status === 'HR_APPROVED'
            ? (isArabic ? 'تم الاعتماد تلقائيًا' : 'Auto-approved')
            : (isArabic ? 'تم تسجيل الطلب وهو قيد المراجعة' : 'Submitted and pending review');
        const message = isArabic
            ? `تم استلام ${options.requestLabelAr} بنجاح.\nالحالة: ${statusLabel}\nرابط الطباعة: ${printUrl}`
            : `Your ${options.requestLabelEn} has been received.\nStatus: ${statusLabel}\nPrint link: ${printUrl}`;

        const emailSubject = isArabic
            ? `تم استلام ${options.requestLabelAr}`
            : `${options.requestLabelEn} received`;

        const jobs: Promise<unknown>[] = [];
        if (options.user.phone) {
            jobs.push(this.sendWhatsApp(options.user.phone, message));
        }
        if (options.user.email) {
            jobs.push(this.sendEmail({
                to: options.user.email,
                subject: emailSubject,
                html: isArabic
                    ? `<div style="font-family:sans-serif;max-width:600px"><h2>تم استلام ${options.requestLabelAr}</h2><p>الحالة: ${statusLabel}</p><p><a href="${printUrl}">رابط الطباعة</a></p></div>`
                    : `<div style="font-family:sans-serif;max-width:600px"><h2>${options.requestLabelEn} received</h2><p>Status: ${statusLabel}</p><p><a href="${printUrl}">Open print preview</a></p></div>`,
            }));
        }

        if (jobs.length) {
            this.runInBackground(Promise.allSettled(jobs), `Deferred request receipt failed (${options.requestType})`);
        }
    }


    private runInBackground(task: Promise<unknown>, context: string) {
        task.catch((error: any) => {
            this.logger.error(`${context}: ${error?.message || 'Unknown background task error'}`);
        });
    }

    async sendEmail(options: { to: string; subject: string; html: string }) {
        if (!process.env.MAIL_USER) {
            this.logger.warn('Email not configured');
            return;
        }

        try {
            await this.transporter.sendMail({
                from: process.env.MAIL_FROM || 'SPHINX HR <noreply@sphinx.com>',
                ...options,
            });
            this.logger.log(`Email sent to ${options.to}`);
        } catch (err: any) {
            this.logger.error(`Email send failed: ${err.message}`);
        }
    }

    async notifyLeaveAction(
        leaveRequest: any,
        action: 'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected',
        options?: { body?: string; bodyAr?: string; sendExternal?: boolean },
    ) {
        const user = await this.prisma.user.findUnique({ where: { id: leaveRequest.userId } });
        if (!user) return;

        const titles = {
            submitted: { en: 'Leave Request Submitted', ar: 'تم تقديم طلب الإجازة' },
            verified: { en: 'Leave Request Verified', ar: 'تم التحقق من طلب الإجازة' },
            managerApproved: { en: 'Leave Approved by Manager', ar: 'موافقة المدير على طلب الإجازة' },
            approved: { en: 'Leave Request Approved', ar: 'تمت الموافقة على طلب الإجازة' },
            rejected: { en: 'Leave Request Rejected', ar: 'تم رفض طلب الإجازة' },
        };

        const bodies = {
            submitted: {
                en: `Your ${leaveRequest.leaveType} leave request has been submitted and sent to the secretary.`,
                ar: `تم إرسال طلب الإجازة إلى السكرتارية.`,
            },
            verified: {
                en: 'Your leave request was verified and sent to your manager.',
                ar: 'تم التحقق من طلب إجازتك وإرساله إلى المدير.',
            },
            managerApproved: {
                en: 'Your leave request was approved by your manager and sent to HR.',
                ar: 'تمت موافقة المدير على طلب الإجازة وتم إرساله إلى الموارد البشرية.',
            },
            approved: {
                en: `Your leave request from ${leaveRequest.startDate?.toLocaleDateString()} has been approved.`,
                ar: `تمت الموافقة على طلب إجازتك.`,
            },
            rejected: {
                en: `Your leave request has been rejected. Please contact your manager.`,
                ar: `تم رفض طلب إجازتك. يرجى التواصل مع مديرك.`,
            },
        };

        const typeMap: Record<typeof action, string> = {
            submitted: 'LEAVE_REQUEST',
            verified: 'LEAVE_REQUEST',
            managerApproved: 'LEAVE_REQUEST',
            approved: 'LEAVE_APPROVED',
            rejected: 'LEAVE_REJECTED',
        };

        const body = options?.body?.trim() || bodies[action].en;
        const bodyAr = options?.bodyAr?.trim() || bodies[action].ar;

        await this.createInApp({
            receiverId: user.id,
            type: typeMap[action],
            title: titles[action].en,
            titleAr: titles[action].ar,
            body,
            bodyAr,
            metadata: { leaveRequestId: leaveRequest.id },
        });

        const sendExternal = options?.sendExternal ?? ['submitted', 'approved', 'rejected'].includes(action);
        if (sendExternal) {
            const jobs: Promise<unknown>[] = [];
            if (user.phone) {
                jobs.push(this.sendWhatsApp(user.phone, `SPHINX HR: ${titles[action].en}\n${body}`));
            }
            jobs.push(this.sendEmail({
                to: user.email,
                subject: `SPHINX HR - ${titles[action].en}`,
                html: `<div style="font-family:sans-serif;max-width:600px"><h2>${titles[action].en}</h2><p>${body}</p><p>Login to SPHINX HR for details.</p></div>`,
            }));

            this.runInBackground(Promise.allSettled(jobs), `Deferred leave external notifications (${action}) failed`);
        }
    }

    async notifyPermissionAction(
        permissionRequest: any,
        action: 'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected',
        options?: { comment?: string; body?: string; bodyAr?: string; sendExternal?: boolean },
    ) {
        const user = permissionRequest.user
            || (await this.prisma.user.findUnique({ where: { id: permissionRequest.userId } }));
        if (!user) return;

        const titles = {
            submitted: { en: 'Permission Request Submitted', ar: 'تم إرسال طلب الإذن' },
            verified: { en: 'Permission Request Verified', ar: 'تم التحقق من طلب الإذن' },
            managerApproved: { en: 'Permission Approved by Manager', ar: 'موافقة المدير على طلب الإذن' },
            approved: { en: 'Permission Approved', ar: 'تمت الموافقة على طلب الإذن' },
            rejected: { en: 'Permission Rejected', ar: 'تم رفض طلب الإذن' },
        };

        const bodies = {
            submitted: {
                en: 'Your permission request has been submitted and sent to the secretary.',
                ar: 'تم إرسال طلب الإذن إلى السكرتارية.',
            },
            verified: {
                en: 'Your permission request was verified and sent to your manager.',
                ar: 'تم التحقق من طلب الإذن وإرساله إلى المدير.',
            },
            managerApproved: {
                en: 'Your permission request was approved by your manager and sent to HR.',
                ar: 'تمت موافقة المدير على طلب الإذن وتم إرساله إلى الموارد البشرية.',
            },
            approved: {
                en: 'Your permission request has been approved.',
                ar: 'تمت الموافقة على طلب الإذن.',
            },
            rejected: {
                en: 'Your permission request has been rejected. Please contact your manager.',
                ar: 'تم رفض طلب الإذن. يرجى التواصل مع مديرك.',
            },
        };

        const typeMap: Record<typeof action, string> = {
            submitted: 'PERMISSION_REQUEST',
            verified: 'PERMISSION_REQUEST',
            managerApproved: 'PERMISSION_REQUEST',
            approved: 'PERMISSION_APPROVED',
            rejected: 'PERMISSION_REJECTED',
        };

        const commentBody = options?.comment?.trim();
        const body = options?.body?.trim() || commentBody || bodies[action].en;
        const bodyAr = options?.bodyAr?.trim() || commentBody || bodies[action].ar;

        await this.createInApp({
            receiverId: user.id,
            type: typeMap[action],
            title: titles[action].en,
            titleAr: titles[action].ar,
            body,
            bodyAr,
            metadata: { permissionRequestId: permissionRequest.id },
        });

        if (options?.sendExternal && user.phone) {
            this.runInBackground(
                this.sendWhatsApp(user.phone, `SPHINX HR: ${titles[action].en}\n${body}`),
                `Deferred permission external notification (${action}) failed`,
            );
        }
    }
}
