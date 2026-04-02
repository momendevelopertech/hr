import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { endOfDay, startOfDay } from 'date-fns';
import { PusherService } from '../pusher/pusher.service';
import { WhatsAppDeliveryResult, WhatsAppService } from './whatsapp.service';
import { EmailDeliveryResult, EmailService } from './email.service';
import {
    getDefaultNotificationTemplates,
    normalizeNotificationTemplates,
    NotificationTemplateContent,
    NotificationTemplateKey,
} from '../settings/notification-template-defaults';

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

type ExternalDeliveryChannel = 'EMAIL' | 'WHATSAPP';

type ExternalDeliveryLogOptions = {
    channel: ExternalDeliveryChannel;
    recipient?: string | null;
    workflowKey: string;
    templateKey?: string | null;
    subject?: string | null;
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
    metadata?: Record<string, any>;
};

export type AccountCreatedDeliverySummary = {
    emailDelivery: EmailDeliveryResult | null;
    whatsAppDelivery: WhatsAppDeliveryResult | null;
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private prisma: PrismaService,
        private pusher: PusherService,
        private whatsAppService: WhatsAppService,
        private emailService: EmailService,
    ) { }

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

    private async getNotificationTemplate(key: NotificationTemplateKey): Promise<NotificationTemplateContent> {
        try {
            const settings = await this.prisma.workScheduleSettings.findFirst({
                select: { notificationTemplates: true },
            });
            return normalizeNotificationTemplates(settings?.notificationTemplates)[key];
        } catch (error: any) {
            if (error?.code === 'P2022') {
                return getDefaultNotificationTemplates()[key];
            }
            throw error;
        }
    }

    private interpolateTemplateText(template: string, values: Record<string, string>) {
        const interpolated = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => values[key] ?? '');
        return interpolated
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    private renderTemplate(
        template: NotificationTemplateContent,
        locale: NotificationLocale,
        values: Record<string, string>,
    ) {
        return {
            title: this.interpolateTemplateText(locale === 'ar' ? template.titleAr : template.titleEn, values),
            intro: this.interpolateTemplateText(locale === 'ar' ? template.introAr : template.introEn, values),
            footer: this.interpolateTemplateText(locale === 'ar' ? template.footerAr : template.footerEn, values),
        };
    }

    private joinTextBlocks(...parts: Array<string | null | undefined>) {
        return parts.map((part) => (part || '').trim()).filter(Boolean).join('\n');
    }

    private buildTemplateValues(values: Record<string, string | null | undefined>) {
        return Object.entries(values).reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = (value || '').trim();
            return acc;
        }, {});
    }

    private formatTimeRange(arrivalTime?: string | null, leaveTime?: string | null, locale: NotificationLocale = 'ar') {
        if (!arrivalTime || !leaveTime) {
            return locale === 'ar' ? 'غير محدد' : 'Not specified';
        }
        return `${arrivalTime} - ${leaveTime}`;
    }

    private getCommentHint(comment?: string | null, locale: NotificationLocale = 'ar') {
        const normalized = comment?.trim();
        if (!normalized) return '';
        return locale === 'ar' ? `ملاحظة: ${normalized}` : `Comment: ${normalized}`;
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
        footer?: string;
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
                footer: options.footer,
            }),
            emailHtml: this.buildEmailHtml({
                locale: options.locale,
                user: options.user,
                title: options.title,
                intro: options.intro,
                details,
                ctaLabel: isArabic ? 'عرض الطلب' : 'Open request',
                ctaUrl: printUrl,
                footer: options.footer,
            }),
        };
    }

    private isMissingDeliveryLogSchemaError(error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err?.code === 'P2021' || err?.code === 'P2022') {
            return true;
        }
        return typeof err?.message === 'string' && err.message.includes('does not exist');
    }

    private async createDeliveryLog(options: ExternalDeliveryLogOptions) {
        const recipient = options.recipient?.trim();
        if (!recipient) return null;

        try {
            return await this.prisma.notificationDelivery.create({
                data: {
                    channel: options.channel,
                    workflowKey: options.workflowKey,
                    templateKey: options.templateKey || null,
                    recipient,
                    subject: options.subject || null,
                    status: 'PENDING',
                    attempts: 0,
                    relatedEntityType: options.relatedEntityType || null,
                    relatedEntityId: options.relatedEntityId || null,
                    metadata: options.metadata || undefined,
                },
                select: { id: true },
            });
        } catch (error) {
            if (this.isMissingDeliveryLogSchemaError(error)) {
                this.logger.warn('Notification delivery log table is not available yet. Run prisma db push before relying on delivery tracking.');
                return null;
            }
            throw error;
        }
    }

    private async updateDeliveryLog(id: string | null | undefined, data: Record<string, any>) {
        if (!id) return;

        try {
            await this.prisma.notificationDelivery.update({
                where: { id },
                data,
            });
        } catch (error) {
            if (!this.isMissingDeliveryLogSchemaError(error)) {
                throw error;
            }
        }
    }

    private async sendLoggedEmail(options: ExternalDeliveryLogOptions & { subject: string; html: string }) {
        const recipient = options.recipient?.trim();
        if (!recipient) return null;

        const log = await this.createDeliveryLog({
            ...options,
            recipient,
            subject: options.subject,
        });
        const result = await this.emailService.sendEmail({
            to: recipient,
            subject: options.subject,
            html: options.html,
        });

        await this.updateDeliveryLog(log?.id, {
            status: result.ok ? 'SENT' : 'FAILED',
            attempts: result.attempts,
            lastError: result.error || null,
            providerMessageId: result.messageId || null,
            sentAt: result.ok ? new Date() : null,
            metadata: {
                ...(options.metadata || {}),
                response: result.response || null,
            },
        });

        return result;
    }

    private async sendLoggedWhatsApp(options: ExternalDeliveryLogOptions & { message: string }) {
        const recipient = options.recipient?.trim();
        if (!recipient) return null;

        const log = await this.createDeliveryLog({
            ...options,
            recipient,
        });
        const result = await this.whatsAppService.sendWhatsApp(recipient, options.message);

        await this.updateDeliveryLog(log?.id, {
            status: result.ok ? 'SENT' : 'FAILED',
            attempts: result.attempts,
            lastError: result.error || null,
            providerMessageId: null,
            sentAt: result.ok ? new Date() : null,
            metadata: {
                ...(options.metadata || {}),
                source: result.source || null,
                statusCode: result.status || null,
            },
        });

        return result;
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

    hasEmailConfig() {
        return this.emailService.hasConfig();
    }

    async sendWhatsApp(phone: string, message: string): Promise<WhatsAppDeliveryResult> {
        return this.whatsAppService.sendWhatsApp(phone, message);
    }

    sendWhatsAppInBackground(phone: string | null | undefined, message: string, context: string) {
        if (!phone) return;
        this.runInBackground(
            this.sendLoggedWhatsApp({
                channel: 'WHATSAPP',
                recipient: phone,
                message,
                workflowKey: 'adHoc.whatsApp',
                metadata: { context },
            }),
            context,
        );
    }

    async sendAccountCreatedMessage(user: {
        id?: string;
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
        waitForExternalDeliveries?: boolean;
    }): Promise<AccountCreatedDeliverySummary> {
        const locale = this.getPreferredLocale(user);
        const isArabic = locale === 'ar';
        const loginUrl = this.getPublicAppUrl(locale);
        const template = await this.getNotificationTemplate('accountCreated');
        const passwordHintAr = options?.temporaryPassword
            ? 'يرجى تغيير كلمة المرور بعد أول تسجيل دخول.'
            : 'يمكنك الآن الدخول ومتابعة طلباتك بكل سهولة.';
        const passwordHintEn = options?.temporaryPassword
            ? 'Please change your password after your first login.'
            : 'You can now sign in and track your requests easily.';
        const templateValues = this.buildTemplateValues({
            employeeName: this.getDisplayName(user, locale),
            employeeNumber: user.employeeNumber || '-',
            username: user.username || user.email,
            workflowMode: this.getWorkflowModeLabel(user.workflowMode, locale),
            temporaryPassword: options?.temporaryPassword || '',
            passwordHint: locale === 'ar' ? passwordHintAr : passwordHintEn,
        });
        const rendered = this.renderTemplate(template, locale, templateValues);
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

        const message = this.composeWhatsAppMessage({
            locale,
            user,
            title: rendered.title,
            intro: rendered.intro,
            details,
            linkLabel: isArabic ? '🔗 رابط الدخول:' : '🔗 Login link:',
            linkUrl: loginUrl,
            footer: rendered.footer,
        });
        const emailSubject = rendered.title;
        const emailBody = this.buildEmailHtml({
            locale,
            user,
            title: rendered.title,
            intro: rendered.intro,
            details,
            ctaLabel: isArabic ? 'الدخول إلى النظام' : 'Open SPHINX HR',
            ctaUrl: loginUrl,
            footer: rendered.footer,
        });

        const emailJob = user.email
            ? this.sendLoggedEmail({
                channel: 'EMAIL',
                recipient: user.email,
                workflowKey: 'accountCreated',
                templateKey: 'accountCreated',
                subject: emailSubject,
                html: emailBody,
                relatedEntityType: 'User',
                relatedEntityId: user.id,
                metadata: { locale },
            })
            : null;

        if (options?.syncWhatsApp || options?.waitForExternalDeliveries) {
            const [whatsAppResult, emailResult] = await Promise.all([
                user.phone
                    ? this.sendLoggedWhatsApp({
                        channel: 'WHATSAPP',
                        recipient: user.phone,
                        message,
                        workflowKey: 'accountCreated',
                        templateKey: 'accountCreated',
                        relatedEntityType: 'User',
                        relatedEntityId: user.id,
                        metadata: { locale, syncWhatsApp: true },
                    })
                    : Promise.resolve(null),
                emailJob ?? Promise.resolve(null),
            ]);

            return {
                emailDelivery: emailResult,
                whatsAppDelivery: whatsAppResult,
            };
        }

        const jobs: Promise<unknown>[] = [];
        if (user.phone) {
            jobs.push(this.sendLoggedWhatsApp({
                channel: 'WHATSAPP',
                recipient: user.phone,
                message,
                workflowKey: 'accountCreated',
                templateKey: 'accountCreated',
                relatedEntityType: 'User',
                relatedEntityId: user.id,
                metadata: { locale },
            }));
        }
        if (emailJob) {
            jobs.push(emailJob);
        }

        if (jobs.length) {
            this.runInBackground(Promise.allSettled(jobs), 'Deferred account-created notification failed');
        }

        return {
            emailDelivery: null,
            whatsAppDelivery: null,
        };
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
        const emailSubject = isArabic ? 'رمز إعادة تعيين كلمة المرور' : 'Password reset code';
        const emailHtml = isArabic
            ? `<div style="font-family:sans-serif;max-width:600px"><h2>رمز إعادة التعيين</h2><p>رمز التحقق: <strong>${options.code}</strong></p><p>صلاحية الرمز 10 دقائق.</p><p><a href="${resetUrl}">افتح صفحة إعادة التعيين</a></p></div>`
            : `<div style="font-family:sans-serif;max-width:600px"><h2>Password reset code</h2><p>Your verification code is <strong>${options.code}</strong>.</p><p>The code expires in 10 minutes.</p><p><a href="${resetUrl}">Open reset page</a></p></div>`;

        if (options.channel === 'WHATSAPP' && options.user.phone) {
            this.runInBackground(
                this.sendLoggedWhatsApp({
                    channel: 'WHATSAPP',
                    recipient: options.user.phone,
                    message,
                    workflowKey: 'passwordReset',
                    relatedEntityType: 'User',
                    relatedEntityId: options.user.id,
                    metadata: { locale },
                }),
                `Deferred password reset WhatsApp failed for user ${options.user.id}`,
            );
            return;
        }

        await this.sendLoggedEmail({
            channel: 'EMAIL',
            recipient: options.user.email,
            workflowKey: 'passwordReset',
            subject: emailSubject,
            html: emailHtml,
            relatedEntityType: 'User',
            relatedEntityId: options.user.id,
            metadata: { locale },
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
        const templateKey = options.requestType === 'leave' ? 'leaveReceipt' : 'permissionReceipt';
        const template = await this.getNotificationTemplate(templateKey);
        const statusLabel = options.status === 'HR_APPROVED'
            ? (isArabic ? 'تم الاعتماد تلقائيًا' : 'Auto-approved')
            : (isArabic ? 'تم تسجيل الطلب وهو قيد المراجعة' : 'Submitted and pending review');
        const templateValues = this.buildTemplateValues({
            employeeName: this.getDisplayName(options.user, locale),
            requestLabel: isArabic ? options.requestLabelAr : options.requestLabelEn,
            status: statusLabel,
            requestType: options.requestType === 'leave'
                ? this.getLeaveTypeLabel(options.requestDetails.leaveType, locale)
                : this.getPermissionTypeLabel(options.requestDetails.permissionType, locale),
            leaveType: this.getLeaveTypeLabel(options.requestDetails.leaveType, locale),
            permissionType: this.getPermissionTypeLabel(options.requestDetails.permissionType, locale),
            requestDate: options.requestType === 'leave'
                ? this.formatDate(options.requestDetails.startDate, locale)
                : this.formatDate(options.requestDetails.requestDate, locale),
            startDate: this.formatDate(options.requestDetails.startDate, locale),
            endDate: this.formatDate(options.requestDetails.endDate, locale),
            duration: options.requestType === 'leave'
                ? this.formatDays(options.requestDetails.totalDays, locale)
                : this.formatHours(options.requestDetails.hoursUsed, locale),
            reason: options.requestDetails.reason || '',
            timeRange: this.formatTimeRange(options.requestDetails.arrivalTime, options.requestDetails.leaveTime, locale),
        });
        const rendered = this.renderTemplate(template, locale, templateValues);
        const externalContent = this.buildRequestExternalContent({
            locale,
            user: options.user,
            requestType: options.requestType,
            requestId: options.requestId,
            title: rendered.title,
            intro: rendered.intro,
            footer: rendered.footer,
            statusLabel,
            requestDetails: options.requestDetails,
        });

        const emailSubject = rendered.title;
        const relatedEntityType = options.requestType === 'leave' ? 'LeaveRequest' : 'PermissionRequest';
        const workflowKey = `${options.requestType}.receipt`;

        const jobs: Promise<unknown>[] = [];
        if (options.user.phone) {
            jobs.push(this.sendLoggedWhatsApp({
                channel: 'WHATSAPP',
                recipient: options.user.phone,
                message: externalContent.whatsAppMessage,
                workflowKey,
                templateKey,
                relatedEntityType,
                relatedEntityId: options.requestId,
                metadata: { locale, status: options.status },
            }));
        }
        if (options.user.email) {
            jobs.push(this.sendLoggedEmail({
                channel: 'EMAIL',
                recipient: options.user.email,
                workflowKey,
                templateKey,
                subject: emailSubject,
                html: externalContent.emailHtml,
                relatedEntityType,
                relatedEntityId: options.requestId,
                metadata: { locale, status: options.status },
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

    async sendEmail(options: { to: string; subject: string; html: string }): Promise<EmailDeliveryResult> {
        return this.emailService.sendEmail(options);
    }

    async notifyLeaveAction(
        leaveRequest: any,
        action: 'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected',
        options?: { comment?: string; body?: string; bodyAr?: string; sendExternal?: boolean },
    ) {
        const user = await this.prisma.user.findUnique({ where: { id: leaveRequest.userId } });
        if (!user) return;

        const templateKeyMap: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', NotificationTemplateKey> = {
            submitted: 'leaveSubmitted',
            verified: 'leaveVerified',
            managerApproved: 'leaveManagerApproved',
            approved: 'leaveApproved',
            rejected: 'leaveRejected',
        };
        const typeMap: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', string> = {
            submitted: 'LEAVE_REQUEST',
            verified: 'LEAVE_REQUEST',
            managerApproved: 'LEAVE_REQUEST',
            approved: 'LEAVE_APPROVED',
            rejected: 'LEAVE_REJECTED',
        };
        const statusLabels: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', Record<NotificationLocale, string>> = {
            submitted: { ar: 'قيد المراجعة', en: 'Under review' },
            verified: { ar: 'تمت المراجعة المبدئية', en: 'Verified' },
            managerApproved: { ar: 'موافقة المدير', en: 'Manager approved' },
            approved: { ar: 'تم الاعتماد', en: 'Approved' },
            rejected: { ar: 'مرفوض', en: 'Rejected' },
        };
        const template = await this.getNotificationTemplate(templateKeyMap[action]);
        const templateValuesAr = this.buildTemplateValues({
            employeeName: this.getDisplayName(user, 'ar'),
            requestLabel: this.getLeaveTypeLabel(leaveRequest.leaveType, 'ar'),
            requestType: this.getLeaveTypeLabel(leaveRequest.leaveType, 'ar'),
            leaveType: this.getLeaveTypeLabel(leaveRequest.leaveType, 'ar'),
            permissionType: '',
            status: statusLabels[action].ar,
            requestDate: this.formatDate(leaveRequest.startDate, 'ar'),
            startDate: this.formatDate(leaveRequest.startDate, 'ar'),
            endDate: this.formatDate(leaveRequest.endDate, 'ar'),
            duration: this.formatDays(leaveRequest.totalDays, 'ar'),
            reason: leaveRequest.reason || '',
            timeRange: '',
            comment: options?.comment || '',
            commentHint: this.getCommentHint(options?.comment, 'ar'),
        });
        const templateValuesEn = this.buildTemplateValues({
            employeeName: this.getDisplayName(user, 'en'),
            requestLabel: this.getLeaveTypeLabel(leaveRequest.leaveType, 'en'),
            requestType: this.getLeaveTypeLabel(leaveRequest.leaveType, 'en'),
            leaveType: this.getLeaveTypeLabel(leaveRequest.leaveType, 'en'),
            permissionType: '',
            status: statusLabels[action].en,
            requestDate: this.formatDate(leaveRequest.startDate, 'en'),
            startDate: this.formatDate(leaveRequest.startDate, 'en'),
            endDate: this.formatDate(leaveRequest.endDate, 'en'),
            duration: this.formatDays(leaveRequest.totalDays, 'en'),
            reason: leaveRequest.reason || '',
            timeRange: '',
            comment: options?.comment || '',
            commentHint: this.getCommentHint(options?.comment, 'en'),
        });
        const renderedAr = this.renderTemplate(template, 'ar', templateValuesAr);
        const renderedEn = this.renderTemplate(template, 'en', templateValuesEn);
        const body = options?.body?.trim() || this.joinTextBlocks(renderedEn.intro, renderedEn.footer);
        const bodyAr = options?.bodyAr?.trim() || this.joinTextBlocks(renderedAr.intro, renderedAr.footer);

        await this.createInApp({
            receiverId: user.id,
            type: typeMap[action],
            title: renderedEn.title,
            titleAr: renderedAr.title,
            body,
            bodyAr,
            metadata: { leaveRequestId: leaveRequest.id },
        });

        const sendExternal = options?.sendExternal ?? ['submitted', 'approved', 'rejected'].includes(action);
        if (sendExternal) {
            const locale = this.getPreferredLocale(user);
            const rendered = locale === 'ar' ? renderedAr : renderedEn;
            const workflowKey = `leave.${action}`;
            const externalContent = this.buildRequestExternalContent({
                locale,
                user,
                requestType: 'leave',
                requestId: leaveRequest.id,
                title: rendered.title,
                intro: rendered.intro,
                footer: rendered.footer,
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
                jobs.push(this.sendLoggedWhatsApp({
                    channel: 'WHATSAPP',
                    recipient: user.phone,
                    message: externalContent.whatsAppMessage,
                    workflowKey,
                    templateKey: templateKeyMap[action],
                    relatedEntityType: 'LeaveRequest',
                    relatedEntityId: leaveRequest.id,
                    metadata: { locale, action },
                }));
            }
            jobs.push(this.sendLoggedEmail({
                channel: 'EMAIL',
                recipient: user.email,
                workflowKey,
                templateKey: templateKeyMap[action],
                subject: `SPHINX HR - ${rendered.title}`,
                html: externalContent.emailHtml,
                relatedEntityType: 'LeaveRequest',
                relatedEntityId: leaveRequest.id,
                metadata: { locale, action },
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

        const templateKeyMap: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', NotificationTemplateKey> = {
            submitted: 'permissionSubmitted',
            verified: 'permissionVerified',
            managerApproved: 'permissionManagerApproved',
            approved: 'permissionApproved',
            rejected: 'permissionRejected',
        };
        const typeMap: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', string> = {
            submitted: 'PERMISSION_REQUEST',
            verified: 'PERMISSION_REQUEST',
            managerApproved: 'PERMISSION_REQUEST',
            approved: 'PERMISSION_APPROVED',
            rejected: 'PERMISSION_REJECTED',
        };
        const commentBody = options?.comment?.trim();
        const statusLabels: Record<'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected', Record<NotificationLocale, string>> = {
            submitted: { ar: 'قيد المراجعة', en: 'Under review' },
            verified: { ar: 'تمت المراجعة المبدئية', en: 'Verified' },
            managerApproved: { ar: 'موافقة المدير', en: 'Manager approved' },
            approved: { ar: 'تم الاعتماد', en: 'Approved' },
            rejected: { ar: 'مرفوض', en: 'Rejected' },
        };
        const template = await this.getNotificationTemplate(templateKeyMap[action]);
        const templateValuesAr = this.buildTemplateValues({
            employeeName: this.getDisplayName(user, 'ar'),
            requestLabel: this.getPermissionTypeLabel(permissionRequest.permissionType, 'ar'),
            requestType: this.getPermissionTypeLabel(permissionRequest.permissionType, 'ar'),
            leaveType: '',
            permissionType: this.getPermissionTypeLabel(permissionRequest.permissionType, 'ar'),
            status: statusLabels[action].ar,
            requestDate: this.formatDate(permissionRequest.requestDate, 'ar'),
            startDate: '',
            endDate: '',
            duration: this.formatHours(permissionRequest.hoursUsed, 'ar'),
            reason: permissionRequest.reason || '',
            timeRange: this.formatTimeRange(permissionRequest.arrivalTime, permissionRequest.leaveTime, 'ar'),
            comment: commentBody || '',
            commentHint: this.getCommentHint(commentBody, 'ar'),
        });
        const templateValuesEn = this.buildTemplateValues({
            employeeName: this.getDisplayName(user, 'en'),
            requestLabel: this.getPermissionTypeLabel(permissionRequest.permissionType, 'en'),
            requestType: this.getPermissionTypeLabel(permissionRequest.permissionType, 'en'),
            leaveType: '',
            permissionType: this.getPermissionTypeLabel(permissionRequest.permissionType, 'en'),
            status: statusLabels[action].en,
            requestDate: this.formatDate(permissionRequest.requestDate, 'en'),
            startDate: '',
            endDate: '',
            duration: this.formatHours(permissionRequest.hoursUsed, 'en'),
            reason: permissionRequest.reason || '',
            timeRange: this.formatTimeRange(permissionRequest.arrivalTime, permissionRequest.leaveTime, 'en'),
            comment: commentBody || '',
            commentHint: this.getCommentHint(commentBody, 'en'),
        });
        const renderedAr = this.renderTemplate(template, 'ar', templateValuesAr);
        const renderedEn = this.renderTemplate(template, 'en', templateValuesEn);
        const body = options?.body?.trim() || this.joinTextBlocks(renderedEn.intro, renderedEn.footer);
        const bodyAr = options?.bodyAr?.trim() || this.joinTextBlocks(renderedAr.intro, renderedAr.footer);

        await this.createInApp({
            receiverId: user.id,
            type: typeMap[action],
            title: renderedEn.title,
            titleAr: renderedAr.title,
            body,
            bodyAr,
            metadata: { permissionRequestId: permissionRequest.id },
        });

        if (options?.sendExternal) {
            const locale = this.getPreferredLocale(user);
            const rendered = locale === 'ar' ? renderedAr : renderedEn;
            const workflowKey = `permission.${action}`;
            const externalContent = this.buildRequestExternalContent({
                locale,
                user,
                requestType: 'permission',
                requestId: permissionRequest.id,
                title: rendered.title,
                intro: rendered.intro,
                footer: rendered.footer,
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

            const jobs: Promise<unknown>[] = [];
            if (user.phone) {
                jobs.push(this.sendLoggedWhatsApp({
                    channel: 'WHATSAPP',
                    recipient: user.phone,
                    message: externalContent.whatsAppMessage,
                    workflowKey,
                    templateKey: templateKeyMap[action],
                    relatedEntityType: 'PermissionRequest',
                    relatedEntityId: permissionRequest.id,
                    metadata: { locale, action },
                }));
            }
            if (user.email) {
                jobs.push(this.sendLoggedEmail({
                    channel: 'EMAIL',
                    recipient: user.email,
                    workflowKey,
                    templateKey: templateKeyMap[action],
                    subject: `SPHINX HR - ${rendered.title}`,
                    html: externalContent.emailHtml,
                    relatedEntityType: 'PermissionRequest',
                    relatedEntityId: permissionRequest.id,
                    metadata: { locale, action },
                }));
            }

            if (jobs.length) {
                this.runInBackground(
                    Promise.allSettled(jobs),
                    `Deferred permission external notification (${action}) failed`,
                );
            }
        }
    }
}
