import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import axios from 'axios';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private transporter: nodemailer.Transporter;

    constructor(
        private prisma: PrismaService,
        private eventsGateway: EventsGateway,
    ) {
        this.transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: parseInt(process.env.MAIL_PORT || '587'),
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

        // Emit via WebSocket
        this.eventsGateway.sendToUser(data.receiverId, 'notification', notification);

        return notification;
    }

    async getUnread(userId: string) {
        return this.prisma.notification.findMany({
            where: { receiverId: userId, isRead: false },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }

    async getAll(userId: string) {
        return this.prisma.notification.findMany({
            where: { receiverId: userId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
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

    async sendWhatsApp(phone: string, message: string) {
        if (!phone || !process.env.WHAPI_TOKEN) {
            this.logger.warn('WhatsApp not configured or phone missing');
            return;
        }

        try {
            // Format phone: ensure it starts with country code
            const formattedPhone = phone.startsWith('+') ? phone.slice(1) : phone;

            await axios.post(
                `${process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud/'}messages/text`,
                {
                    to: `${formattedPhone}@s.whatsapp.net`,
                    body: message,
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.WHAPI_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
            this.logger.log(`WhatsApp sent to ${formattedPhone}`);
        } catch (err) {
            this.logger.error(`WhatsApp send failed: ${err.message}`);
        }
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
        } catch (err) {
            this.logger.error(`Email send failed: ${err.message}`);
        }
    }

    async notifyLeaveAction(leaveRequest: any, action: 'submitted' | 'approved' | 'rejected', actor?: any) {
        const user = await this.prisma.user.findUnique({ where: { id: leaveRequest.userId } });
        if (!user) return;

        const titles = {
            submitted: { en: 'Leave Request Submitted', ar: 'تم تقديم طلب الإجازة' },
            approved: { en: 'Leave Request Approved ✅', ar: 'تمت الموافقة على طلب الإجازة ✅' },
            rejected: { en: 'Leave Request Rejected ❌', ar: 'تم رفض طلب الإجازة ❌' },
        };

        const bodies = {
            submitted: {
                en: `Your ${leaveRequest.leaveType} leave request has been submitted and is pending approval.`,
                ar: `تم تقديم طلب إجازتك وهو في انتظار الموافقة.`,
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

        await this.createInApp({
            receiverId: user.id,
            type: action === 'submitted' ? 'LEAVE_REQUEST' : action === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
            title: titles[action].en,
            titleAr: titles[action].ar,
            body: bodies[action].en,
            bodyAr: bodies[action].ar,
            metadata: { leaveRequestId: leaveRequest.id },
        });

        if (user.phone) {
            await this.sendWhatsApp(user.phone, `📋 SPHINX HR: ${titles[action].en}\n${bodies[action].en}`);
        }

        await this.sendEmail({
            to: user.email,
            subject: `SPHINX HR - ${titles[action].en}`,
            html: `<div style="font-family:sans-serif;max-width:600px"><h2>${titles[action].en}</h2><p>${bodies[action].en}</p><p>Login to SPHINX HR for details.</p></div>`,
        });
    }
}
