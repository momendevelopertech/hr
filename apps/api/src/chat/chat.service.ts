import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
    constructor(private prisma: PrismaService) { }

    async sendMessage(senderId: string, dto: SendMessageDto) {
        return this.prisma.message.create({
            data: {
                senderId,
                receiverId: dto.receiverId,
                messageText: dto.messageText,
            },
        });
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

        return { success: true };
    }

    async getEmployeeChats(employeeId: string) {
        const [employees, unreadGrouped] = await Promise.all([
            this.prisma.user.findMany({
                where: { isActive: true, id: { not: employeeId } },
                select: {
                    id: true,
                    fullName: true,
                    jobTitle: true,
                    governorate: true,
                },
                orderBy: { fullName: 'asc' },
            }),
            this.prisma.message.groupBy({
                by: ['senderId'],
                where: {
                    receiverId: employeeId,
                    readStatus: false,
                },
                _count: { _all: true },
            }),
        ]);

        const unreadMap = new Map(unreadGrouped.map((u) => [u.senderId, u._count._all]));

        return employees.map((employee) => ({
            ...employee,
            unreadCount: unreadMap.get(employee.id) ?? 0,
        }));
    }

    async getEmployees(employeeId: string, search?: string) {
        return this.prisma.user.findMany({
            where: {
                isActive: true,
                id: { not: employeeId },
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
