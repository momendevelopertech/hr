import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type AuditAction = Prisma.AuditLogCreateInput['action'];

interface AuditLogInput {
    userId?: string;
    action: AuditAction;
    entity?: string;
    entityId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
}

@Injectable()
export class AuditService {
    constructor(private prisma: PrismaService) { }

    async log(data: AuditLogInput) {
        try {
            await this.prisma.auditLog.create({ data });
        } catch (err) {
            console.error('Audit log failed:', err.message);
        }
    }

    async getLogs(filters?: { userId?: string; action?: AuditAction; from?: Date; to?: Date }) {
        return this.prisma.auditLog.findMany({
            where: {
                ...(filters?.userId && { userId: filters.userId }),
                ...(filters?.action && { action: filters.action }),
                ...(filters?.from || filters?.to
                    ? {
                        createdAt: {
                            ...(filters?.from && { gte: filters.from }),
                            ...(filters?.to && { lte: filters.to }),
                        },
                    }
                    : {}),
            },
            include: { user: { select: { fullName: true, employeeNumber: true } } },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
    }
}
