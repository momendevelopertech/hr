import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { endOfDay, startOfDay } from 'date-fns';
import { PusherService } from '../pusher/pusher.service';
import * as nodemailer from 'nodemailer';
import { WhatsAppDeliveryResult, WhatsAppService } from './whatsapp.service';

type NotificationLocale = 'ar' | 'en';
type RequestDetails = {
    leaveType?: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    totalDays?: number | null;
    permissionType?: string | null;
    requestDate?: Date | string | null;
    arrivalTime?: string | null;
    leaveTime?: string | null;
    hoursUsed?: number | null;
    reason?: string | null;
};

type MessageDetail = {
    icon: string;
    label: string;
    value: string;
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private transporter: nodemailer.Transporter;

    constructor(
        private prisma: PrismaService,
        private pusher: PusherService,
        private whatsAppService: WhatsAppService,
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

    private getPublicAppUrl(locale = 'ar') {
        const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
        return `${baseUrl}/${locale}`;
    }

    private getPreferredLocale(user?: { fullNameAr?: string | null }): NotificationLocale {
        return user?.fullNameAr ? 'ar' : 'en';
    }

    private getDisplayName(
        user?: { fullName?: string | null; fullNameAr?: string | null },
        locale: NotificationLocale = 'ar',
    ) {
        const preferredName = locale === 'ar'
            ? user?.fullNameAr || user?.fullName
            : user?.fullName || user?.fullNameAr;
        return (preferredName || (locale === 'ar' ? 'زميلنا العزيز' : 'there')).trim();
    }

    private getGreeting(
        user?: { fullName?: string | null; fullNameAr?: string | null },
        locale: NotificationLocale = 'ar',
    ) {
        const name = this.getDisplayName(user, locale);
        return locale === 'ar' ? `عزيزي ${name}،` : `Dear ${name},`;
    }

    private toDate(value?: Date | string | null) {
        if (!value) return null;
        const parsed = value instanceof Date ? value : new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private formatDate(value?: Date | string | null, locale: NotificationLocale = 'ar') {
        const date = this.toDate(value);
        if (!date) {
            return locale === 'ar' ? 'غير محدد' : 'Not specified';
        }

        return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
            dateStyle: 'medium',
        }).format(date);
    }

    private formatNumber(value: number, locale: NotificationLocale = 'ar', maximumFractionDigits = 1) {
        return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
            maximumFractionDigits,
        }).format(value);
    }

    private formatDays(value?: number | null, locale: NotificationLocale = 'ar') {
        if (value === null || value === undefined || !Number.isFinite(value)) {
            return locale === 'ar' ? 'غير محدد' : 'Not specified';
        }

        const formatted = this.formatNumber(value, locale, Number.isInteger(value) ? 0 : 1);
        return locale === 'ar' ? `${formatted} يوم` : `${formatted} day${value === 1 ? '' : 's'}`;
    }

    private formatHours(value?: number | null, locale: NotificationLocale = 'ar') {
        if (value === null || value === undefined || !Number.isFinite(value)) {
            return locale === 'ar' ? 'غير محدد' : 'Not specified';
        }

        const formatted = this.formatNumber(value, locale, Number.isInteger(value) ? 0 : 1);
        return locale === 'ar' ? `${formatted} ساعة` : `${formatted} hour${value === 1 ? '' : 's'}`;
    }

    private getWorkflowModeLabel(workflowMode?: string | null, locale: NotificationLocale = 'ar') {
        if (workflowMode === 'SANDBOX') {
            return locale === 'ar' ? 'وضع التجربة' : 'Sandbox Mode';
        }
        return locale === 'ar' ? 'سير الموافقات' : 'Approval Workflow';
    }

    private getLeaveTypeLabel(leaveType?: string | null, locale: NotificationLocale = 'ar') {
        const labels: Record<string, Record<NotificationLocale, string>> = {
            ANNUAL: { ar: 'إجازة اعتيادية', en: 'Annual leave' },
            CASUAL: { ar: 'إجازة عارضة', en: 'Casual leave' },
            EMERGENCY: { ar: 'إجازة طارئة', en: 'Emergency leave' },
            MISSION: { ar: 'مأمورية', en: 'Mission' },
            ABSENCE_WITH_PERMISSION: { ar: 'غياب بإذن', en: 'Absence with permission' },
        };

        return labels[leaveType || '']?.[locale] || (locale === 'ar' ? 'طلب إجازة' : 'Leave request');
    }

    private getPermissionTypeLabel(permissionType?: string | null, locale: NotificationLocale = 'ar') {
        const labels: Record<string, Record<NotificationLocale, string>> = {
            PERSONAL: { ar: 'إذن شخصي', en: 'Personal permission' },
            LATE_ARRIVAL: { ar: 'إذن تأخير', en: 'Late arrival permission' },
            EARLY_LEAVE: { ar: 'إذن انصراف مبكر', en: 'Early leave permission' },
        };

        return labels[permissionType || '']?.[locale] || (locale === 'ar' ? 'طلب إذن' : 'Permission request');
    }

    private buildRequestDetailItems(
        requestType: 'leave' | 'permission',
        details: RequestDetails,
        locale: NotificationLocale = 'ar',
    ): MessageDetail[] {
        const items: Array<MessageDetail | null> = [];
        const reason = details.reason?.trim();

        if (requestType === 'leave') {
            items.push({
                icon: '🗂️',
                label: locale === 'ar' ? 'نوع الطلب' : 'Request type',
                value: this.getLeaveTypeLabel(details.leaveType, locale),
            });

            const startDate = this.toDate(details.startDate);
            const endDate = this.toDate(details.endDate);
            if (startDate && endDate && startDate.getTime() !== endDate.getTime()) {
                items.push(
                    {
                        icon: '📅',
                        label: locale === 'ar' ? 'من' : 'From',
                        value: this.formatDate(startDate, locale),
                    },
                    {
                        icon: '📅',
                        label: locale === 'ar' ? 'إلى' : 'To',
                        value: this.formatDate(endDate, locale),
                    },
                );
            } else {
                items.push({
                    icon: '📅',
                    label: locale === 'ar' ? 'التاريخ' : 'Date',
                    value: this.formatDate(startDate || endDate, locale),
                });
            }

            if (details.totalDays !== null && details.totalDays !== undefined) {
                items.push({
                    icon: '⏳',
                    label: locale === 'ar' ? 'المدة' : 'Duration',
                    value: this.formatDays(details.totalDays, locale),
                });
            }
        } else {
            items.push({
                icon: '🗂️',
                label: locale === 'ar' ? 'نوع الطلب' : 'Request type',
                value: this.getPermissionTypeLabel(details.permissionType, locale),
            });
            items.push({
                icon: '📅',
                label: locale === 'ar' ? 'التاريخ' : 'Date',
                value: this.formatDate(details.requestDate, locale),
            });

            if (details.arrivalTime && details.leaveTime) {
                items.push({
                    icon: '⏰',
                    label: locale === 'ar' ? 'الوقت' : 'Time',
                    value: `${details.arrivalTime} - ${details.leaveTime}`,
                });
            }

            if (details.hoursUsed !== null && details.hoursUsed !== undefined) {
                items.push({
                    icon: '⏳',
                    label: locale === 'ar' ? 'المدة' : 'Duration',
                    value: this.formatHours(details.hoursUsed, locale),
                });
            }
        }

        if (reason) {
            items.push({
                icon: '📝',
                label: locale === 'ar' ? 'التفاصيل' : 'Details',
                value: reason,
            });
        }

        return items.filter((item): item is MessageDetail => Boolean(item));
    }

    private composeWhatsAppMessage(options: {
        locale: NotificationLocale;
        user?: { fullName?: string | null; fullNameAr?: string | null };
        title: string;
        intro: string;
        details?: MessageDetail[];
        linkLabel?: string;
        linkUrl?: string;
        footer?: string;
    }) {
        const lines: string[] = [
            '*SPHINX HR*',
            `👋 ${this.getGreeting(options.user, options.locale)}`,
            '',
            `*${options.title}*`,
            options.intro,
        ];

        if (options.details?.length) {
            lines.push('', ...options.details.map((item) => `${item.icon} ${item.label}: ${item.value}`));
        }

        if (options.linkUrl) {
            lines.push('', options.linkLabel || (options.locale === 'ar' ? '🔗 رابط الطلب:' : '🔗 Request link:'), options.linkUrl);
        }

        if (options.footer) {
            lines.push('', options.footer);
        }

        return lines.join('\n');
    }

    private escapeHtml(value: string) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private buildEmailHtml(options: {
        locale: NotificationLocale;
        user?: { fullName?: string | null; fullNameAr?: string | null };
        title: string;
        intro: string;
        details?: MessageDetail[];
        ctaLabel?: string;
        ctaUrl?: string;
        footer?: string;
    }) {
        const greeting = this.escapeHtml(this.getGreeting(options.user, options.locale));
        const intro = this.escapeHtml(options.intro);
        const detailItems = (options.details || [])
            .map((item) => `<li style="margin:0 0 8px"><strong>${this.escapeHtml(item.label)}:</strong> ${this.escapeHtml(item.value)}</li>`)
            .join('');

        return `
            <div style="font-family:Tahoma,Arial,sans-serif;max-width:640px;color:#0f172a;line-height:1.8">
                <div style="border:1px solid #e2e8f0;border-radius:18px;padding:24px;background:#ffffff">
                    <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.18em;color:#64748b">SPHINX HR</p>
                    <h2 style="margin:0 0 12px;font-size:24px">${this.escapeHtml(options.title)}</h2>
                    <p style="margin:0 0 10px">${greeting}</p>
                    <p style="margin:0 0 18px">${intro}</p>
                    ${detailItems ? `<ul style="padding-${options.locale === 'ar' ? 'right' : 'left'}:18px;margin:0 0 18px">${detailItems}</ul>` : ''}
                    ${options.ctaUrl && options.ctaLabel
                ? `<p style="margin:0 0 18px"><a href="${this.escapeHtml(options.ctaUrl)}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:999px">${this.escapeHtml(options.ctaLabel)}</a></p>`
                : ''}
                    ${options.footer ? `<p style="margin:0;color:#475569">${this.escapeHtml(options.footer)}</p>` : ''}
                </div>
            </div>
        `;
    }

    private buildRequestPrintUrl(
        requestType: 'leave' | 'permission',
        requestId: string,
        locale = 'ar',
    ) {
        return `${this.getPublicAppUrl(locale)}/requests/print/${requestType}/${requestId}`;
    }

    private buildRequestExternalContent(options: {
        locale: NotificationLocale;
        user?: { fullName?: string | null; fullNameAr?: string | null };
        requestType: 'leave' | 'permission';
        requestId: string;
        title: string;
        intro: string;
        statusLabel: string;
        requestDetails: RequestDetails;
        comment?: string;
    }) {
        const isArabic = options.locale === 'ar';
        const printUrl = this.buildRequestPrintUrl(options.requestType, options.requestId, options.locale);
        const details = [
            ...this.buildRequestDetailItems(options.requestType, options.requestDetails, options.locale),
            {
                icon: '📌',
                label: isArabic ? 'الحالة' : 'Status',
                value: options.statusLabel,
            },
        ];
        const comment = options.comment?.trim();
        if (comment) {
            details.push({
                icon: '💬',
                label: isArabic ? 'ملاحظة' : 'Comment',
                value: comment,
            });
        }

        return {
            printUrl,
            whatsAppMessage: this.composeWhatsAppMessage({
                locale: options.locale,
                user: options.user,
                title: options.title,
                intro: options.intro,
                details,
                linkLabel: isArabic ? '🔗 رابط الطلب:' : '🔗 Request link:',
                linkUrl: printUrl,
            }),
            emailHtml: this.buildEmailHtml({
                locale: options.locale,
                user: options.user,
                title: options.title,
                intro: options.intro,
                details,
                ctaLabel: isArabic ? 'عرض الطلب' : 'Open request',
                ctaUrl: printUrl,
            }),
        };
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

    async hasWhatsAppConfig() {
        return this.whatsAppService.hasConfig();
    }

    async sendWhatsApp(phone: string, message: string): Promise<WhatsAppDeliveryResult> {
        return this.whatsAppService.sendWhatsApp(phone, message);
    }

    sendWhatsAppInBackground(phone: string | null | undefined, message: string, context: string) {
        if (!phone) return;
        this.runInBackground(this.sendWhatsApp(phone, message), context);
    }

    async sendAccountCreatedMessage(user: {
        fullName: string;
        fullNameAr?: string | null;
        email: string;
        phone?: string | null;
        employeeNumber?: string | null;
        username?: string | null;
        workflowMode?: string | null;
    }, options?: {
        temporaryPassword?: string | null;
        syncWhatsApp?: boolean;
    }) {
        const locale = this.getPreferredLocale(user);
        const isArabic = locale === 'ar';
        const loginUrl = this.getPublicAppUrl(locale);
        const title = isArabic ? 'تم إنشاء حسابك بنجاح' : 'Your account is ready';
        const intro = isArabic
            ? 'تم تجهيز حسابك على SPHINX HR ويمكنك تسجيل الدخول من الرابط التالي.'
            : 'Your SPHINX HR account is ready and you can sign in from the link below.';
        const details: MessageDetail[] = [
            {
                icon: '🆔',
                label: isArabic ? 'رقم الموظف' : 'Employee #',
                value: user.employeeNumber || '-',
            },
            {
                icon: '👤',
                label: isArabic ? 'اسم المستخدم' : 'Username',
                value: user.username || user.email,
            },
            {
                icon: '📌',
                label: isArabic ? 'وضع الطلبات' : 'Request mode',
                value: this.getWorkflowModeLabel(user.workflowMode, locale),
            },
        ];

        if (options?.temporaryPassword) {
            details.splice(2, 0, {
                icon: '🔐',
                label: isArabic ? 'كلمة المرور المؤقتة' : 'Temporary password',
                value: options.temporaryPassword,
            });
        }

        const footer = options?.temporaryPassword
            ? (isArabic ? 'يرجى تغيير كلمة المرور بعد أول تسجيل دخول.' : 'Please change your password after your first login.')
            : (isArabic ? 'يمكنك الآن الدخول ومتابعة طلباتك بكل سهولة.' : 'You can now sign in and track your requests easily.');
        const message = this.composeWhatsAppMessage({
            locale,
            user,
            title,
            intro,
            details,
            linkLabel: isArabic ? '🔗 رابط الدخول:' : '🔗 Login link:',
            linkUrl: loginUrl,
            footer,
        });
        const emailSubject = isArabic ? 'تم إنشاء حسابك على SPHINX HR' : 'Your SPHINX HR account is ready';
        const emailBody = this.buildEmailHtml({
            locale,
            user,
            title,
            intro,
            details,
            ctaLabel: isArabic ? 'الدخول إلى النظام' : 'Open SPHINX HR',
            ctaUrl: loginUrl,
            footer,
        });

        const emailJob = user.email
            ? this.sendEmail({
                to: user.email,
                subject: emailSubject,
                html: emailBody,
            })
            : null;

        if (options?.syncWhatsApp) {
            const whatsAppDelivery = user.phone
                ? await this.sendWhatsApp(user.phone, message)
                : null;

            if (emailJob) {
                this.runInBackground(emailJob, 'Deferred account-created email failed');
            }

            return whatsAppDelivery;
        }

        const jobs: Promise<unknown>[] = [];
        if (user.phone) {
            jobs.push(this.sendWhatsApp(user.phone, message));
        }
        if (emailJob) {
            jobs.push(emailJob);
        }

        if (jobs.length) {
            this.runInBackground(Promise.allSettled(jobs), 'Deferred account-created notification failed');
        }

        return null;
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
            this.sendWhatsAppInBackground(
                options.user.phone,
                message,
                `Deferred password reset WhatsApp failed for user ${options.user.id}`,
            );
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
        requestDetails: RequestDetails;
    }) {
        const locale = this.getPreferredLocale(options.user);
        const isArabic = locale === 'ar';
        const statusLabel = options.status === 'HR_APPROVED'
            ? (isArabic ? 'تم الاعتماد تلقائيًا' : 'Auto-approved')
            : (isArabic ? 'تم تسجيل الطلب وهو قيد المراجعة' : 'Submitted and pending review');
        const title = isArabic
            ? `تم استلام ${options.requestLabelAr}`
            : `${options.requestLabelEn} received`;
        const intro = isArabic
            ? 'تم تسجيل طلبك بنجاح ويمكنك مراجعة التفاصيل من الرابط التالي.'
            : 'Your request has been recorded successfully and you can review the details from the link below.';
        const externalContent = this.buildRequestExternalContent({
            locale,
            user: options.user,
            requestType: options.requestType,
            requestId: options.requestId,
            title,
            intro,
            statusLabel,
            requestDetails: options.requestDetails,
        });

        const emailSubject = isArabic
            ? `تم استلام ${options.requestLabelAr}`
            : `${options.requestLabelEn} received`;

        const jobs: Promise<unknown>[] = [];
        if (options.user.phone) {
            jobs.push(this.sendWhatsApp(options.user.phone, externalContent.whatsAppMessage));
        }
        if (options.user.email) {
            jobs.push(this.sendEmail({
                to: options.user.email,
                subject: emailSubject,
                html: externalContent.emailHtml,
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
        options?: { comment?: string; body?: string; bodyAr?: string; sendExternal?: boolean },
    ) {
        const user = await this.prisma.user.findUnique({ where: { id: leaveRequest.userId } });
        if (!user) return;

        const titles: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', Record<NotificationLocale, string>> = {
            submitted: { en: 'Leave Request Submitted', ar: 'تم تقديم طلب الإجازة' },
            verified: { en: 'Leave Request Verified', ar: 'تم التحقق من طلب الإجازة' },
            managerApproved: { en: 'Leave Approved by Manager', ar: 'موافقة المدير على طلب الإجازة' },
            approved: { en: 'Leave Request Approved', ar: 'تمت الموافقة على طلب الإجازة' },
            rejected: { en: 'Leave Request Rejected', ar: 'تم رفض طلب الإجازة' },
        };

        const bodies = {
            submitted: {
                en: `Your ${this.getLeaveTypeLabel(leaveRequest.leaveType, 'en')} has been submitted and sent to the secretary.`,
                ar: 'تم تسجيل طلب الإجازة وإرساله إلى السكرتارية للمراجعة.',
            },
            verified: {
                en: 'Your leave request was verified and sent to your manager.',
                ar: 'تمت مراجعة طلب الإجازة وإرساله إلى المدير.',
            },
            managerApproved: {
                en: 'Your leave request was approved by your manager and sent to HR.',
                ar: 'وافق المدير على طلب الإجازة وتم تحويله إلى الموارد البشرية.',
            },
            approved: {
                en: 'Your leave request has been approved.',
                ar: 'تم اعتماد طلب الإجازة الخاص بك.',
            },
            rejected: {
                en: 'Your leave request has been rejected. Please contact your manager.',
                ar: 'تم رفض طلب الإجازة. يرجى التواصل مع مديرك.',
            },
        };

        const typeMap: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', string> = {
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
            const locale = this.getPreferredLocale(user);
            const statusLabels: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', Record<NotificationLocale, string>> = {
                submitted: { ar: 'قيد المراجعة', en: 'Under review' },
                verified: { ar: 'تمت المراجعة المبدئية', en: 'Verified' },
                managerApproved: { ar: 'موافقة المدير', en: 'Manager approved' },
                approved: { ar: 'تم الاعتماد', en: 'Approved' },
                rejected: { ar: 'مرفوض', en: 'Rejected' },
            };
            const intro = locale === 'ar' ? bodyAr : body;
            const externalContent = this.buildRequestExternalContent({
                locale,
                user,
                requestType: 'leave',
                requestId: leaveRequest.id,
                title: titles[action][locale],
                intro,
                statusLabel: statusLabels[action][locale],
                requestDetails: {
                    leaveType: leaveRequest.leaveType,
                    startDate: leaveRequest.startDate,
                    endDate: leaveRequest.endDate,
                    totalDays: leaveRequest.totalDays,
                    reason: leaveRequest.reason,
                },
                comment: options?.comment,
            });

            const jobs: Promise<unknown>[] = [];
            if (user.phone) {
                jobs.push(this.sendWhatsApp(user.phone, externalContent.whatsAppMessage));
            }
            jobs.push(this.sendEmail({
                to: user.email,
                subject: `SPHINX HR - ${titles[action].en}`,
                html: externalContent.emailHtml,
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

        const titles: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', Record<NotificationLocale, string>> = {
            submitted: { en: 'Permission Request Submitted', ar: 'تم إرسال طلب الإذن' },
            verified: { en: 'Permission Request Verified', ar: 'تم التحقق من طلب الإذن' },
            managerApproved: { en: 'Permission Approved by Manager', ar: 'موافقة المدير على طلب الإذن' },
            approved: { en: 'Permission Approved', ar: 'تمت الموافقة على طلب الإذن' },
            rejected: { en: 'Permission Rejected', ar: 'تم رفض طلب الإذن' },
        };

        const bodies = {
            submitted: {
                en: 'Your permission request has been submitted and sent to the secretary.',
                ar: 'تم تسجيل طلب الإذن وإرساله إلى السكرتارية للمراجعة.',
            },
            verified: {
                en: 'Your permission request was verified and sent to your manager.',
                ar: 'تمت مراجعة طلب الإذن وإرساله إلى المدير.',
            },
            managerApproved: {
                en: 'Your permission request was approved by your manager and sent to HR.',
                ar: 'وافق المدير على طلب الإذن وتم تحويله إلى الموارد البشرية.',
            },
            approved: {
                en: 'Your permission request has been approved.',
                ar: 'تم اعتماد طلب الإذن الخاص بك.',
            },
            rejected: {
                en: 'Your permission request has been rejected. Please contact your manager.',
                ar: 'تم رفض طلب الإذن. يرجى التواصل مع مديرك.',
            },
        };

        const typeMap: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', string> = {
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
            const locale = this.getPreferredLocale(user);
            const statusLabels: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', Record<NotificationLocale, string>> = {
                submitted: { ar: 'قيد المراجعة', en: 'Under review' },
                verified: { ar: 'تمت المراجعة المبدئية', en: 'Verified' },
                managerApproved: { ar: 'موافقة المدير', en: 'Manager approved' },
                approved: { ar: 'تم الاعتماد', en: 'Approved' },
                rejected: { ar: 'مرفوض', en: 'Rejected' },
            };
            const intro = locale === 'ar' ? bodyAr : body;
            const externalContent = this.buildRequestExternalContent({
                locale,
                user,
                requestType: 'permission',
                requestId: permissionRequest.id,
                title: titles[action][locale],
                intro,
                statusLabel: statusLabels[action][locale],
                requestDetails: {
                    permissionType: permissionRequest.permissionType,
                    requestDate: permissionRequest.requestDate,
                    arrivalTime: permissionRequest.arrivalTime,
                    leaveTime: permissionRequest.leaveTime,
                    hoursUsed: permissionRequest.hoursUsed,
                    reason: permissionRequest.reason,
                },
                comment: commentBody,
            });

            this.runInBackground(
                this.sendWhatsApp(user.phone, externalContent.whatsAppMessage),
                `Deferred permission external notification (${action}) failed`,
            );
        }
    }
}
