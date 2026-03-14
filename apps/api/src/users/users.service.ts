import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { endOfDay, startOfDay } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { matchesEmployeeSearch } from '../shared/search-normalization';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
        private auditService: AuditService,
        private redisService: RedisService,
    ) { }

    private normalizePhone(phone?: string) {
        if (!phone) return undefined;
        return phone.replace(/\D/g, '');
    }

    private validatePhone(phone?: string) {
        const normalizedPhone = this.normalizePhone(phone);
        if (!normalizedPhone) return undefined;
        if (!/^\d{11}$/.test(normalizedPhone)) {
            throw new BadRequestException('Phone number must be exactly 11 digits');
        }
        return normalizedPhone;
    }

    private parseBranchId(value?: any) {
        if (value === undefined || value === null || value === '') return undefined;
        const parsed = typeof value === 'string' ? parseInt(value, 10) : value;
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    private inferGovernorateFromBranchName(name?: string | null) {
        if (!name) return undefined;
        const normalized = name.toLowerCase();
        if (normalized.includes('alex')) return 'ALEXANDRIA';
        if (normalized.includes('cairo')) return 'CAIRO';
        return undefined;
    }

    private async resolveBranchByGovernorate(governorate?: string | null) {
        if (!governorate) return null;
        const branchName = governorate === 'ALEXANDRIA'
            ? 'Alexandria'
            : governorate === 'CAIRO'
                ? 'Cairo'
                : null;
        if (!branchName) return null;
        return this.prisma.branch.findFirst({ where: { name: branchName } });
    }

    async create(data: {
        employeeNumber: string;
        fullName: string;
        fullNameAr?: string;
        email: string;
        phone?: string;
        password?: string;
        role?: any;
        governorate?: any;
        branchId?: number;
        departmentId?: string;
        jobTitle?: string;
        jobTitleAr?: string;
        fingerprintId?: string;
    }, createdById?: string) {
        const defaultPassword = 'SPHINX@2026';
        const password = data.password || defaultPassword;
        const normalizedPhone = this.validatePhone(data.phone);
        const phoneLast4 = (normalizedPhone || '').slice(-4) || '0000';
        const baseName = (data.fullName || 'user').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'user';
        const generatedUsername = `${baseName}${phoneLast4}`.toLowerCase();

        const role = data.role || 'EMPLOYEE';
        const branchIdInput = this.parseBranchId(data.branchId);
        let branchId = branchIdInput;
        let governorate = data.governorate;
        let branch: { id: number; name: string } | null = null;

        if (branchId) {
            branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
            if (!branch) throw new BadRequestException('Invalid branch selection');
            if (!governorate) {
                governorate = this.inferGovernorateFromBranchName(branch.name);
            }
        } else if (governorate) {
            branch = await this.resolveBranchByGovernorate(governorate);
            branchId = branch?.id;
        }

        const branchRequired = !['SUPER_ADMIN', 'HR_ADMIN'].includes(role);
        if (branchRequired && !branchId) {
            throw new BadRequestException('Branch is required');
        }

        const departmentRequired = ['EMPLOYEE', 'MANAGER'].includes(role);
        if (departmentRequired && !data.departmentId) {
            throw new BadRequestException('Department is required');
        }

        if (data.departmentId && branchId) {
            const link = await this.prisma.departmentBranch.findFirst({
                where: { departmentId: data.departmentId, branchId },
            });
            if (!link) {
                throw new BadRequestException('Department is not available in this branch');
            }
        }

        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: data.email },
                    { employeeNumber: data.employeeNumber },
                    { username: generatedUsername },
                ],
            },
        });
        if (existing) throw new ConflictException('Employee with this email, employee number, or username already exists');

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await this.prisma.user.create({
            data: {
                employeeNumber: data.employeeNumber,
                username: generatedUsername,
                fullName: data.fullName,
                fullNameAr: data.fullNameAr,
                email: data.email,
                phone: normalizedPhone,
                passwordHash,
                role,
                governorate,
                branchId,
                departmentId: data.departmentId,
                jobTitle: data.jobTitle,
                jobTitleAr: data.jobTitleAr,
                fingerprintId: data.fingerprintId || data.employeeNumber,
                mustChangePass: true,
            },
            include: { department: true },
        });

        await this.auditService.log({
            userId: createdById,
            action: 'EMPLOYEE_CREATED',
            entity: 'User',
            entityId: user.id,
            details: { employeeNumber: user.employeeNumber, email: user.email, username: generatedUsername },
        });

        const year = new Date().getFullYear();
        for (const leaveType of ['ANNUAL', 'CASUAL', 'EMERGENCY', 'MISSION'] as const) {
            const totalDays = leaveType === 'ANNUAL' ? 21 : leaveType === 'CASUAL' ? 7 : leaveType === 'EMERGENCY' ? 3 : 10;
            await this.prisma.leaveBalance.create({
                data: {
                    userId: user.id,
                    year,
                    leaveType,
                    totalDays,
                    usedDays: 0,
                    remainingDays: totalDays,
                },
            });
        }

        await this.notificationsService.createInApp({
            receiverId: user.id,
            type: 'ACCOUNT_CREATED',
            title: 'Welcome to SPHINX HR',
            titleAr: 'مرحبًا بك في SPHINX HR',
            body: `Your account has been created. Employee #${user.employeeNumber}. Please change your password on first login.`,
            bodyAr: `تم إنشاء حسابك. رقم الموظف: ${user.employeeNumber}. يرجى تغيير كلمة المرور عند أول تسجيل دخول.`,
        });

        if (user.phone) {
            await this.notificationsService.sendWhatsApp(
                user.phone,
                `Welcome to SPHINX HR System!\nEmployee #: ${user.employeeNumber}\nUsername: ${generatedUsername}\nTemporary Password: ${password}\nPlease login and change your password immediately: ${process.env.FRONTEND_URL}`,
            );
        }

        await this.notificationsService.sendEmail({
            to: user.email,
            subject: 'Welcome to SPHINX HR System',
            html: `<div style="font-family:sans-serif"><h2>Welcome to SPHINX HR, ${user.fullName}!</h2><p>Your account has been created.</p><ul><li>Employee #: ${user.employeeNumber}</li><li>Username: ${generatedUsername}</li><li>Temporary Password: ${password}</li></ul><p><a href="${process.env.FRONTEND_URL}">Login here</a> and change your password immediately.</p></div>`,
        });

        return {
            ...user,
            generatedUsername,
            defaultPassword: password,
        };
    }

    async findAll(requesterId: string, requesterRole: string, params?: {
        departmentId?: string;
        page?: number;
        limit?: number;
        name?: string;
        phone?: string;
        status?: string;
        from?: string;
        to?: string;
        search?: string;
        governorate?: string;
    }) {
        const where: any = {};
        const page = Math.max(1, params?.page || 1);
        const limit = Math.min(100, Math.max(1, params?.limit || 20));
        const skip = (page - 1) * limit;

        if (requesterRole === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: requesterId } });
            where.departmentId = manager?.departmentId;
        } else if (requesterRole === 'BRANCH_SECRETARY') {
            const secretary = await this.prisma.user.findUnique({ where: { id: requesterId } });
            if (secretary?.governorate) {
                where.governorate = secretary.governorate;
            }
        } else {
            if (params?.departmentId) where.departmentId = params.departmentId;
            if (params?.governorate) where.governorate = params.governorate as any;
        }

        if (params?.phone) where.phone = { contains: params.phone, mode: 'insensitive' };
        if (params?.status === 'active') where.isActive = true;
        if (params?.status === 'inactive') where.isActive = false;
        if (params?.from || params?.to) {
            where.createdAt = {
                ...(params?.from ? { gte: new Date(params.from) } : {}),
                ...(params?.to ? { lte: new Date(params.to) } : {}),
            };
        }
        if (params?.search) {
            where.OR = [
                { fullName: { contains: params.search, mode: 'insensitive' } },
                { email: { contains: params.search, mode: 'insensitive' } },
                { employeeNumber: { contains: params.search, mode: 'insensitive' } },
                { username: { contains: params.search, mode: 'insensitive' } },
                { phone: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        const cacheKey = `users:${requesterRole}:${requesterId}:${JSON.stringify(params || {})}`;
        const cached = await this.redisService.getJSON<any>(cacheKey);
        if (cached) return cached;

        const nameQuery = params?.name?.trim();
        if (nameQuery) {
            const candidates = await this.prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    employeeNumber: true,
                    username: true,
                    fullName: true,
                    fullNameAr: true,
                    email: true,
                    phone: true,
                    role: true,
                    governorate: true,
                    branchId: true,
                    jobTitle: true,
                    jobTitleAr: true,
                    isActive: true,
                    profileImage: true,
                    mustChangePass: true,
                    department: { select: { id: true, name: true, nameAr: true, managerId: true } },
                    createdAt: true,
                },
            });
            const filtered = candidates.filter((user) => matchesEmployeeSearch(nameQuery, user));
            const items = filtered.slice(skip, skip + limit);
            const total = filtered.length;
            const payload = { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
            await this.redisService.setJSON(cacheKey, payload, 30);
            return payload;
        }

        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    employeeNumber: true,
                    username: true,
                    fullName: true,
                    fullNameAr: true,
                    email: true,
                    phone: true,
                    role: true,
                    governorate: true,
                    branchId: true,
                    jobTitle: true,
                    jobTitleAr: true,
                    isActive: true,
                    profileImage: true,
                    mustChangePass: true,
                    department: { select: { id: true, name: true, nameAr: true, managerId: true } },
                    createdAt: true,
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        const payload = { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
        await this.redisService.setJSON(cacheKey, payload, 30);
        return payload;
    }

    async findById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                department: {
                    include: {
                        manager: { select: { id: true, fullName: true, email: true } },
                    },
                },
                leaveBalances: { where: { year: new Date().getFullYear() } },
            },
        });
        if (!user) throw new NotFoundException('Employee not found');
        return user;
    }

    async update(id: string, data: any, updatedById?: string) {
        const normalizedPhone = data.phone !== undefined ? this.validatePhone(data.phone) : undefined;

        const existing = await this.prisma.user.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Employee not found');

        const role = data.role || existing.role;
        const branchIdInput = this.parseBranchId(data.branchId);
        let branchId = existing.branchId ?? undefined;
        let governorate = existing.governorate ?? undefined;

        if (branchIdInput !== undefined) {
            branchId = branchIdInput;
            if (branchId) {
                const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
                if (!branch) throw new BadRequestException('Invalid branch selection');
                if (data.governorate === undefined) {
                    governorate = this.inferGovernorateFromBranchName(branch.name);
                }
            } else if (data.governorate === undefined) {
                governorate = null;
            }
        }

        if (data.governorate !== undefined) {
            governorate = data.governorate || null;
            if (branchIdInput === undefined) {
                const branchFromGov = await this.resolveBranchByGovernorate(governorate);
                if (branchFromGov) branchId = branchFromGov.id;
            }
        }

        const branchRequired = !['SUPER_ADMIN', 'HR_ADMIN'].includes(role);
        if (branchRequired && !branchId) {
            throw new BadRequestException('Branch is required');
        }

        const departmentId = data.departmentId !== undefined ? (data.departmentId || null) : existing.departmentId;
        const departmentRequired = ['EMPLOYEE', 'MANAGER'].includes(role);
        if (departmentRequired && !departmentId) {
            throw new BadRequestException('Department is required');
        }

        if (departmentId && branchId) {
            const link = await this.prisma.departmentBranch.findFirst({
                where: { departmentId, branchId },
            });
            if (!link) {
                throw new BadRequestException('Department is not available in this branch');
            }
        }

        const updateData: any = {
            ...(data.fullName && { fullName: data.fullName }),
            ...(data.fullNameAr && { fullNameAr: data.fullNameAr }),
            ...(data.phone !== undefined && { phone: normalizedPhone }),
            ...(data.role && { role: data.role }),
            ...(data.jobTitle && { jobTitle: data.jobTitle }),
            ...(data.jobTitleAr && { jobTitleAr: data.jobTitleAr }),
            ...(data.fingerprintId && { fingerprintId: data.fingerprintId }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
            ...(data.profileImage && { profileImage: data.profileImage }),
        };

        if (data.governorate !== undefined || data.branchId !== undefined) {
            updateData.governorate = governorate;
            updateData.branchId = branchId ?? null;
        }
        if (data.departmentId !== undefined) {
            updateData.departmentId = departmentId;
        }

        const user = await this.prisma.user.update({
            where: { id },
            data: updateData,
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

    private async ensureCanViewEmployee(targetUserId: string, requesterId: string, requesterRole: string) {
        if (requesterRole === 'HR_ADMIN' || requesterRole === 'SUPER_ADMIN') return;

        if (requesterRole === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: requesterId } });
            const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
            if (!manager || !target || manager.departmentId !== target.departmentId) {
                throw new ForbiddenException();
            }
            return;
        }

        if (requesterRole === 'BRANCH_SECRETARY') {
            const secretary = await this.prisma.user.findUnique({ where: { id: requesterId } });
            const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
            if (!secretary || !target || secretary.governorate !== target.governorate) {
                throw new ForbiddenException();
            }
            return;
        }

        if (requesterRole === 'EMPLOYEE' && requesterId !== targetUserId) {
            throw new ForbiddenException();
        }
    }

    async resetEmployeeData(targetUserId: string, adminId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
        if (!user) throw new NotFoundException('Employee not found');

        const year = new Date().getFullYear();
        const defaults = [
            { leaveType: 'ANNUAL', totalDays: 21 },
            { leaveType: 'CASUAL', totalDays: 7 },
            { leaveType: 'EMERGENCY', totalDays: 3 },
            { leaveType: 'MISSION', totalDays: 10 },
        ];

        await this.prisma.$transaction(async (tx) => {
            await tx.notification.deleteMany({
                where: {
                    OR: [{ receiverId: targetUserId }, { senderId: targetUserId }],
                },
            });
            await tx.note.deleteMany({ where: { userId: targetUserId } });
            await tx.lateness.deleteMany({ where: { userId: targetUserId } });
            await tx.permissionRequest.deleteMany({ where: { userId: targetUserId } });
            await tx.leaveRequest.deleteMany({ where: { userId: targetUserId } });
            await tx.formSubmission.deleteMany({ where: { userId: targetUserId } });
            await tx.permissionCycle.deleteMany({ where: { userId: targetUserId } });
            await tx.leaveBalance.deleteMany({ where: { userId: targetUserId } });
            await tx.leaveBalance.createMany({
                data: defaults.map((item) => ({
                    userId: targetUserId,
                    year,
                    leaveType: item.leaveType as any,
                    totalDays: item.totalDays,
                    usedDays: 0,
                    remainingDays: item.totalDays,
                })),
            });
        });

        await this.auditService.log({
            userId: adminId,
            action: 'EMPLOYEE_UPDATED',
            entity: 'User',
            entityId: targetUserId,
            details: { reset: true },
        });

        return { message: 'Employee data reset.' };
    }

    async getStats(targetUserId: string, requesterId: string, requesterRole: string) {
        await this.ensureCanViewEmployee(targetUserId, requesterId, requesterRole);

        const year = new Date().getFullYear();
        const [balances, leaves, permissions] = await Promise.all([
            this.prisma.leaveBalance.findMany({ where: { userId: targetUserId, year } }),
            this.prisma.leaveRequest.findMany({
                where: { userId: targetUserId },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.permissionRequest.findMany({
                where: { userId: targetUserId },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        const leaveApproved = leaves.filter((l) => l.status === 'HR_APPROVED').length;
        const leavePending = leaves.filter((l) => l.status === 'PENDING' || l.status === 'MANAGER_APPROVED').length;
        const permissionApproved = permissions.filter((p) => p.status === 'HR_APPROVED').length;
        const permissionPending = permissions.filter((p) => p.status === 'PENDING' || p.status === 'MANAGER_APPROVED').length;
        const absences = leaves.filter((l) => l.leaveType === 'ABSENCE_WITH_PERMISSION').length;
        const annual = balances.find((b) => b.leaveType === 'ANNUAL');

        return {
            leaveBalances: balances,
            leaveCounts: {
                total: leaves.length,
                approved: leaveApproved,
                pending: leavePending,
            },
            permissionCounts: {
                total: permissions.length,
                approved: permissionApproved,
                pending: permissionPending,
            },
            absences,
            remainingAnnual: annual?.remainingDays ?? 0,
            requests: {
                leaves,
                permissions,
            },
        };
    }

    async getRequestHistory(
        targetUserId: string,
        requesterId: string,
        requesterRole: string,
        options?: { from?: string; to?: string; includeDetails?: boolean },
    ) {
        await this.ensureCanViewEmployee(targetUserId, requesterId, requesterRole);

        const parseDate = (value?: string) => {
            if (!value) return undefined;
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) {
                throw new BadRequestException('Invalid date range');
            }
            return parsed;
        };

        const fromDate = parseDate(options?.from);
        const toDate = parseDate(options?.to);

        const leaveWhere: any = {
            userId: targetUserId,
            status: 'HR_APPROVED',
            ...(fromDate || toDate
                ? {
                    startDate: {
                        ...(fromDate ? { gte: startOfDay(fromDate) } : {}),
                        ...(toDate ? { lte: endOfDay(toDate) } : {}),
                    },
                }
                : {}),
        };

        const permissionWhere: any = {
            userId: targetUserId,
            status: 'HR_APPROVED',
            ...(fromDate || toDate
                ? {
                    requestDate: {
                        ...(fromDate ? { gte: startOfDay(fromDate) } : {}),
                        ...(toDate ? { lte: endOfDay(toDate) } : {}),
                    },
                }
                : {}),
        };

        const [leaves, permissions] = await Promise.all([
            this.prisma.leaveRequest.findMany({
                where: leaveWhere,
                orderBy: { startDate: 'desc' },
                select: {
                    id: true,
                    leaveType: true,
                    startDate: true,
                    endDate: true,
                    totalDays: true,
                    createdAt: true,
                },
            }),
            this.prisma.permissionRequest.findMany({
                where: permissionWhere,
                orderBy: { requestDate: 'desc' },
                select: {
                    id: true,
                    permissionType: true,
                    requestDate: true,
                    hoursUsed: true,
                    createdAt: true,
                },
            }),
        ]);

        const leaveTypeToKey: Record<string, string> = {
            ANNUAL: 'annual',
            CASUAL: 'casual',
            MISSION: 'mission',
            ABSENCE_WITH_PERMISSION: 'absence',
            EMERGENCY: 'emergency',
        };

        const ensureCycle = (cycles: Map<string, any>, date: Date) => {
            const year = date.getFullYear();
            const monthIndex = date.getMonth();
            const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            if (cycles.has(key)) return cycles.get(key);

            const cycleStart = new Date(year, monthIndex, 1);
            const cycleEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
            const entry = {
                key,
                start: cycleStart,
                end: cycleEnd,
                totals: {
                    annual: 0,
                    casual: 0,
                    mission: 0,
                    absence: 0,
                    emergency: 0,
                    permissions: 0,
                    other: 0,
                },
                details: options?.includeDetails
                    ? {
                        annual: [] as any[],
                        casual: [] as any[],
                        mission: [] as any[],
                        absence: [] as any[],
                        emergency: [] as any[],
                        permissions: [] as any[],
                        other: [] as any[],
                    }
                    : undefined,
            };
            cycles.set(key, entry);
            return entry;
        };

        const cycles = new Map<string, any>();

        leaves.forEach((leave) => {
            const cycle = ensureCycle(cycles, new Date(leave.startDate));
            const key = leaveTypeToKey[leave.leaveType] || 'other';
            cycle.totals[key] = (cycle.totals[key] || 0) + 1;
            if (cycle.details) {
                cycle.details[key] = cycle.details[key] || [];
                cycle.details[key].push({
                    id: leave.id,
                    leaveType: leave.leaveType,
                    startDate: leave.startDate,
                    endDate: leave.endDate,
                    totalDays: leave.totalDays,
                    createdAt: leave.createdAt,
                });
            }
        });

        permissions.forEach((permission) => {
            const cycle = ensureCycle(cycles, new Date(permission.requestDate));
            cycle.totals.permissions += 1;
            if (cycle.details) {
                cycle.details.permissions.push({
                    id: permission.id,
                    permissionType: permission.permissionType,
                    requestDate: permission.requestDate,
                    hoursUsed: permission.hoursUsed,
                    createdAt: permission.createdAt,
                });
            }
        });

        const now = new Date();
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentCycle = cycles.get(currentKey)
            || ensureCycle(cycles, now);

        const items = Array.from(cycles.values())
            .sort((a, b) => b.start.getTime() - a.start.getTime())
            .map((cycle) => ({
                key: cycle.key,
                start: cycle.start.toISOString(),
                end: cycle.end.toISOString(),
                totals: cycle.totals,
                details: cycle.details
                    ? {
                        annual: cycle.details.annual || [],
                        casual: cycle.details.casual || [],
                        mission: cycle.details.mission || [],
                        absence: cycle.details.absence || [],
                        emergency: cycle.details.emergency || [],
                        permissions: cycle.details.permissions || [],
                        other: cycle.details.other || [],
                    }
                    : undefined,
            }));

        return {
            userId: targetUserId,
            range: {
                from: fromDate ? startOfDay(fromDate).toISOString() : null,
                to: toDate ? endOfDay(toDate).toISOString() : null,
            },
            currentCycle: {
                key: currentCycle.key,
                start: currentCycle.start.toISOString(),
                end: currentCycle.end.toISOString(),
                totals: currentCycle.totals,
                details: currentCycle.details
                    ? {
                        annual: currentCycle.details.annual || [],
                        casual: currentCycle.details.casual || [],
                        mission: currentCycle.details.mission || [],
                        absence: currentCycle.details.absence || [],
                        emergency: currentCycle.details.emergency || [],
                        permissions: currentCycle.details.permissions || [],
                        other: currentCycle.details.other || [],
                    }
                    : undefined,
            },
            cycles: items,
        };
    }
}


