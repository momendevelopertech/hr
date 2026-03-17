import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { endOfDay, startOfDay } from 'date-fns';
import { PusherService } from '../pusher/pusher.service';
import axios from 'axios';
import * as nodemailer from 'nodemailer';

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
        if (!phone || !process.env.WHAPI_TOKEN) {
            this.logger.warn('WhatsApp not configured or phone missing');
            return;
        }

        try {
            const formattedPhone = phone.startsWith('+') ? phone.slice(1) : phone;
            await axios.post(
                `${process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud/'}messages/text`,
                { to: `${formattedPhone}@s.whatsapp.net`, body: message },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.WHAPI_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            this.logger.log(`WhatsApp sent to ${formattedPhone}`);
        } catch (err: any) {
            this.logger.error(`WhatsApp send failed: ${err.message}`);
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

        await this.createInApp({
            receiverId: user.id,
            type: typeMap[action],
            title: titles[action].en,
            titleAr: titles[action].ar,
            body: bodies[action].en,
            bodyAr: bodies[action].ar,
            metadata: { leaveRequestId: leaveRequest.id },
        });

        if (['submitted', 'approved', 'rejected'].includes(action)) {
            const jobs: Promise<unknown>[] = [];
            if (user.phone) {
                jobs.push(this.sendWhatsApp(user.phone, `SPHINX HR: ${titles[action].en}\n${bodies[action].en}`));
            }
            jobs.push(this.sendEmail({
                to: user.email,
                subject: `SPHINX HR - ${titles[action].en}`,
                html: `<div style="font-family:sans-serif;max-width:600px"><h2>${titles[action].en}</h2><p>${bodies[action].en}</p><p>Login to SPHINX HR for details.</p></div>`,
            }));

            this.runInBackground(Promise.allSettled(jobs), `Deferred leave external notifications (${action}) failed`);
        }
    }

    async notifyPermissionAction(
        permissionRequest: any,
        action: 'submitted' | 'verified' | 'managerApproved' | 'approved' | 'rejected',
        options?: { comment?: string; sendExternal?: boolean },
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

        const body = options?.comment?.trim() ? options.comment : bodies[action].en;
        const bodyAr = options?.comment?.trim() ? options.comment : bodies[action].ar;

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
