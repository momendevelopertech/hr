import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
        private auditService: AuditService,
        private redisService: RedisService,
    ) { }

    async create(data: {
        employeeNumber: string;
        fullName: string;
        fullNameAr?: string;
        email: string;
        phone?: string;
        password: string;
        role?: any;
        departmentId?: string;
        jobTitle?: string;
        jobTitleAr?: string;
        fingerprintId?: string;
    }, createdById?: string) {
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email: data.email }, { employeeNumber: data.employeeNumber }] },
        });
        if (existing) throw new ConflictException('Employee with this email or employee number already exists');

        const passwordHash = await bcrypt.hash(data.password, 12);

        const user = await this.prisma.user.create({
            data: {
                employeeNumber: data.employeeNumber,
                fullName: data.fullName,
                fullNameAr: data.fullNameAr,
                email: data.email,
                phone: data.phone,
                passwordHash,
                role: data.role || 'EMPLOYEE',
                departmentId: data.departmentId,
                jobTitle: data.jobTitle,
                jobTitleAr: data.jobTitleAr,
                fingerprintId: data.fingerprintId,
                mustChangePass: true,
            },
            include: { department: true },
        });

        await this.auditService.log({
            userId: createdById,
            action: 'EMPLOYEE_CREATED',
            entity: 'User',
            entityId: user.id,
            details: { employeeNumber: user.employeeNumber, email: user.email },
        });

        // Create default leave balances for current year
        const year = new Date().getFullYear();
        for (const leaveType of ['ANNUAL', 'EMERGENCY', 'MISSION'] as const) {
            await this.prisma.leaveBalance.create({
                data: {
                    userId: user.id,
                    year,
                    leaveType,
                    totalDays: leaveType === 'ANNUAL' ? 21 : leaveType === 'EMERGENCY' ? 3 : 10,
                    usedDays: 0,
                    remainingDays: leaveType === 'ANNUAL' ? 21 : leaveType === 'EMERGENCY' ? 3 : 10,
                },
            });
        }

        // Send welcome notifications
        await this.notificationsService.createInApp({
            receiverId: user.id,
            type: 'ACCOUNT_CREATED',
            title: 'Welcome to SPHINX HR',
            titleAr: 'مرحباً بك في SPHINX HR',
            body: `Your account has been created. Employee #${user.employeeNumber}. Please change your password on first login.`,
            bodyAr: `تم إنشاء حسابك. رقم الموظف: ${user.employeeNumber}. يرجى تغيير كلمة المرور عند أول تسجيل دخول.`,
        });

        if (user.phone) {
            await this.notificationsService.sendWhatsApp(
                user.phone,
                `🎉 Welcome to SPHINX HR System!\nEmployee #: ${user.employeeNumber}\nEmail: ${user.email}\nTemporary Password: ${data.password}\nPlease login and change your password immediately: ${process.env.FRONTEND_URL}`,
            );
        }

        await this.notificationsService.sendEmail({
            to: user.email,
            subject: 'Welcome to SPHINX HR System',
            html: `<div style="font-family:sans-serif"><h2>Welcome to SPHINX HR, ${user.fullName}!</h2><p>Your account has been created.</p><ul><li>Employee #: ${user.employeeNumber}</li><li>Temporary Password: ${data.password}</li></ul><p><a href="${process.env.FRONTEND_URL}">Login here</a> and change your password immediately.</p></div>`,
        });

        return user;
    }

    async findAll(requesterId: string, requesterRole: string, departmentId?: string) {
        const where: any = {};

        if (requesterRole === 'MANAGER') {
            // Managers only see their department employees
            const manager = await this.prisma.user.findUnique({ where: { id: requesterId } });
            where.departmentId = manager?.departmentId;
        } else if (departmentId) {
            where.departmentId = departmentId;
        }

        const cacheKey = `users:${requesterRole}:${requesterId}:${departmentId || 'all'}`;
        const cached = await this.redisService.getJSON<any[]>(cacheKey);
        if (cached) return cached;

        const users = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                employeeNumber: true,
                fullName: true,
                fullNameAr: true,
                email: true,
                phone: true,
                role: true,
                jobTitle: true,
                jobTitleAr: true,
                isActive: true,
                profileImage: true,
                mustChangePass: true,
                department: { select: { id: true, name: true, nameAr: true } },
                createdAt: true,
            },
        });

        await this.redisService.setJSON(cacheKey, users, 30);
        return users;
    }

    async findById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                department: true,
                leaveBalances: { where: { year: new Date().getFullYear() } },
            },
        });
        if (!user) throw new NotFoundException('Employee not found');
        return user;
    }

    async update(id: string, data: any, updatedById?: string) {
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                ...(data.fullName && { fullName: data.fullName }),
                ...(data.fullNameAr && { fullNameAr: data.fullNameAr }),
                ...(data.phone && { phone: data.phone }),
                ...(data.role && { role: data.role }),
                ...(data.departmentId && { departmentId: data.departmentId }),
                ...(data.jobTitle && { jobTitle: data.jobTitle }),
                ...(data.jobTitleAr && { jobTitleAr: data.jobTitleAr }),
                ...(data.fingerprintId && { fingerprintId: data.fingerprintId }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.profileImage && { profileImage: data.profileImage }),
            },
            include: { department: true },
        });

        await this.auditService.log({
            userId: updatedById,
            action: 'EMPLOYEE_UPDATED',
            entity: 'User',
            entityId: id,
            details: data,
        });

        return user;
    }

    async deactivate(id: string, adminId: string) {
        await this.prisma.user.update({ where: { id }, data: { isActive: false } });
        await this.auditService.log({ userId: adminId, action: 'EMPLOYEE_DELETED', entity: 'User', entityId: id });
    }

    async updateLeaveBalance(userId: string, leaveType: string, year: number, totalDays: number) {
        return this.prisma.leaveBalance.upsert({
            where: { userId_year_leaveType: { userId, year, leaveType: leaveType as any } },
            update: { totalDays, remainingDays: totalDays },
            create: {
                userId,
                year,
                leaveType: leaveType as any,
                totalDays,
                usedDays: 0,
                remainingDays: totalDays,
            },
        });
    }
}
