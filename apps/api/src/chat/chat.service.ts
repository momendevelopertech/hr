import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { PusherService } from '../pusher/pusher.service';

@Injectable()
export class ChatService {
    constructor(
        private prisma: PrismaService,
        private pusher: PusherService,
    ) { }

    async sendMessage(senderId: string, dto: SendMessageDto) {
        const saved = await this.prisma.message.create({
            data: {
                senderId,
                receiverId: dto.receiverId,
                messageText: dto.messageText,
            },
        });

        // Realtime: push to both participants.
        await Promise.all([
            this.pusher.triggerToUser(dto.receiverId, 'receive_message', saved),
            this.pusher.triggerToUser(senderId, 'receive_message', saved),
        ]);

        return saved;
    }

    async getConversation(senderId: string, receiverId: string) {
        return this.prisma.message.findMany({
            where: {
                OR: [
                    { senderId, receiverId },
                    { senderId: receiverId, receiverId: senderId },
                ],
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    async markAsRead(readerId: string, senderId: string) {
        await this.prisma.message.updateMany({
            where: {
                senderId,
                receiverId: readerId,
                readStatus: false,
            },
            data: { readStatus: true },
        });

        // Realtime: inform both participants so unread counters refresh without a page reload.
        await Promise.all([
            this.pusher.triggerToUser(senderId, 'message_read', {
                readerId,
                senderId,
            }),
            this.pusher.triggerToUser(readerId, 'message_read', {
                readerId,
                senderId,
            }),
        ]);

        return { success: true };
    }

    async getEmployeeChats(employeeId: string, roleFilter?: string) {
        const userWhere: any = {
            isActive: true,
            id: { not: employeeId },
            ...(roleFilter ? { role: roleFilter as any } : {}),
        };

        const [recentMessages, unreadGrouped, users] = await Promise.all([
            this.prisma.message.findMany({
                where: {
                    OR: [{ senderId: employeeId }, { receiverId: employeeId }],
                },
                select: {
                    senderId: true,
                    receiverId: true,
                    messageText: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.message.groupBy({
                by: ['senderId'],
                where: {
                    receiverId: employeeId,
                    readStatus: false,
                },
                _count: { _all: true },
            }),
            this.prisma.user.findMany({
                where: userWhere,
                select: {
                    id: true,
                    fullName: true,
                    jobTitle: true,
                    governorate: true,
                    role: true,
                },
            }),
        ]);

        const userMap = new Map<string, { id: string; fullName: string; jobTitle: string | null; governorate: 'CAIRO' | 'ALEXANDRIA' | null; role: string }>(
            users.map((user) => [user.id, user]),
        );
        const unreadMap = new Map(unreadGrouped.map((u) => [u.senderId, u._count._all]));
        const latestByPartner = new Map<string, { messageText: string; createdAt: Date }>();

        for (const message of recentMessages) {
            const partnerId = message.senderId === employeeId ? message.receiverId : message.senderId;
            if (!latestByPartner.has(partnerId)) {
                latestByPartner.set(partnerId, {
                    messageText: message.messageText,
                    createdAt: message.createdAt,
                });
            }
        }

        const chatSummaries = Array.from(latestByPartner.entries())
            .filter(([partnerId]) => userMap.has(partnerId))
            .map(([partnerId, latest]) => {
                const user = userMap.get(partnerId);
                if (!user) return null;
                return {
                    id: user.id,
                    fullName: user.fullName,
                    jobTitle: user.jobTitle,
                    governorate: user.governorate,
                    role: user.role,
                    unreadCount: unreadMap.get(partnerId) ?? 0,
                    lastMessage: latest.messageText,
                    lastMessageAt: latest.createdAt,
                };
            })
            .filter((chat): chat is NonNullable<typeof chat> => !!chat)
            .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

        const supportExtras = users
            .filter((user) => user.role === 'SUPPORT' && !latestByPartner.has(user.id))
            .map((user) => ({
                id: user.id,
                fullName: user.fullName,
                jobTitle: user.jobTitle,
                governorate: user.governorate,
                role: user.role,
                unreadCount: 0,
                lastMessage: undefined,
                lastMessageAt: undefined,
            }));

        const combined = [...supportExtras, ...chatSummaries];

        combined.sort((a, b) => {
            const rankA = a.role === 'SUPPORT' ? 0 : 1;
            const rankB = b.role === 'SUPPORT' ? 0 : 1;
            if (rankA !== rankB) return rankA - rankB;
            const timeA = a.lastMessageAt ? a.lastMessageAt.getTime() : 0;
            const timeB = b.lastMessageAt ? b.lastMessageAt.getTime() : 0;
            return timeB - timeA;
        });

        return combined;
    }

    async getEmployees(employeeId: string, search?: string, roleFilter?: string) {
        return this.prisma.user.findMany({
            where: {
                isActive: true,
                id: { not: employeeId },
                ...(roleFilter ? { role: roleFilter as any } : {}),
                ...(search
                    ? {
                        OR: [
                            { fullName: { contains: search, mode: 'insensitive' } },
                            { jobTitle: { contains: search, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            select: {
                id: true,
                fullName: true,
                jobTitle: true,
                governorate: true,
            },
            orderBy: { fullName: 'asc' },
        });
    }
}
