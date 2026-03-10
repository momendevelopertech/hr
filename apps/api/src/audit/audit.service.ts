import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
const auditActions = [
    'LOGIN',
    'LOGOUT',
    'LOGIN_FAILED',
    'ACCOUNT_LOCKED',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET',
    'EMPLOYEE_CREATED',
    'EMPLOYEE_UPDATED',
    'EMPLOYEE_DELETED',
    'LEAVE_REQUESTED',
    'LEAVE_APPROVED',
    'LEAVE_REJECTED',
    'LEAVE_CANCELLED',
    'PERMISSION_REQUESTED',
    'PERMISSION_APPROVED',
    'PERMISSION_REJECTED',
    'PERMISSION_CANCELLED',
    'FORM_CREATED',
    'FORM_SUBMITTED',
    'FORM_APPROVED',
    'FORM_REJECTED',
    'REQUEST_EDITED',
    'REQUEST_DELETED',
    'DEPARTMENT_CREATED',
    'DEPARTMENT_UPDATED',
] as const;

type AuditAction = (typeof auditActions)[number];

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
