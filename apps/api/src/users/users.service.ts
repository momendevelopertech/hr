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
import { isEgyptianMobilePhone, normalizeEgyptMobilePhone } from '../shared/egypt-phone';
import { matchesEmployeeSearch, normalizeDigits, normalizeSearchText } from '../shared/search-normalization';
import * as bcrypt from 'bcrypt';
import { getCycleRange } from '../shared/cycle';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

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
        const normalized = normalizeEgyptMobilePhone(phone);
        return normalized || undefined;
    }

    private validatePhone(phone?: string) {
        const normalizedPhone = this.normalizePhone(phone);
        if (!normalizedPhone) return undefined;
        if (!isEgyptianMobilePhone(normalizedPhone)) {
            throw new BadRequestException('Phone number must be a valid Egyptian mobile number');
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

    private normalizeUsernameBase(value?: string) {
        const normalized = (value || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 24);
        return normalized || 'employee';
    }

    private normalizeText(value?: string | null) {
        return (value || '').replace(/\s+/g, ' ').trim();
    }

    private async clearUserCaches() {
        await Promise.all([
            this.redisService.delByPrefix('users:'),
            this.redisService.delByPrefix('reports:'),
        ]);
    }

    private validateEnglishFullName(value?: string | null) {
        const normalized = this.normalizeText(value);
        if (!normalized) {
            throw new BadRequestException('Full name is required');
        }
        if (!/^[A-Za-z][A-Za-z\s.'-]{2,}$/.test(normalized)) {
            throw new BadRequestException('Full name must be entered in English');
        }
        return normalized;
    }

    private validateEnglishJobTitle(value?: string | null) {
        const normalized = this.normalizeText(value);
        if (!normalized) {
            throw new BadRequestException('Job title is required');
        }
        if (!/^[A-Za-z0-9][A-Za-z0-9\s.'&()/,-]{1,}$/.test(normalized)) {
            throw new BadRequestException('Job title must be entered in English');
        }
        return normalized;
    }

    private async generateUniqueUsername(fullName: string, email: string) {
        const base = this.normalizeUsernameBase(fullName) || this.normalizeUsernameBase(email.split('@')[0]);

        for (let attempt = 0; attempt < 100; attempt += 1) {
            const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
            const candidate = `${base}${suffix}`.slice(0, 32);
            const existing = await this.prisma.user.findUnique({ where: { username: candidate } });
            if (!existing) {
                return candidate;
            }
        }

        return `${base}-${Date.now().toString().slice(-6)}`.slice(0, 32);
    }

    private async generateEmployeeNumber() {
        const numbers = await this.prisma.user.findMany({
            where: { employeeNumber: { startsWith: 'EMP-' } },
            select: { employeeNumber: true },
        });

        let nextNumber = numbers.reduce((max, item) => {
            const match = /^EMP-(\d+)$/.exec(item.employeeNumber || '');
            if (!match) return max;
            const parsed = parseInt(match[1], 10);
            return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
        }, 0) + 1;

        for (;;) {
            const candidate = `EMP-${String(nextNumber).padStart(4, '0')}`;
            const existing = await this.prisma.user.findUnique({ where: { employeeNumber: candidate } });
            if (!existing) {
                return candidate;
            }
            nextNumber += 1;
        }
    }

    private async initializeLeaveBalances(userId: string, year = new Date().getFullYear()) {
        const defaults = [
            { leaveType: 'ANNUAL', totalDays: 21 },
            { leaveType: 'CASUAL', totalDays: 7 },
            { leaveType: 'EMERGENCY', totalDays: 3 },
            { leaveType: 'MISSION', totalDays: 10 },
        ] as const;

        await this.prisma.leaveBalance.createMany({
            data: defaults.map((item) => ({
                userId,
                year,
                leaveType: item.leaveType,
                totalDays: item.totalDays,
                usedDays: 0,
                remainingDays: item.totalDays,
            })),
            skipDuplicates: true,
        });
    }

    // Request history cycle: day 11 to day 10 next month.
    private getCycleRange(date: Date) {
        return getCycleRange(date, { endOfDay: true });
    }

    private formatCycleKey(date: Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async createSelfRegisteredUser(data: {
        fullName: string;
        fullNameAr?: string;
        email: string;
        phone: string;
        password: string;
        branchId: number;
        departmentId: string;
        jobTitle: string;
        jobTitleAr?: string;
    }) {
        const normalizedEmail = data.email.trim().toLowerCase();
        const fullName = this.validateEnglishFullName(data.fullName);
        const normalizedPhone = this.validatePhone(data.phone);
        if (!normalizedPhone) {
            throw new BadRequestException('Phone number is required');
        }
        const jobTitle = this.validateEnglishJobTitle(data.jobTitle);

        const branchId = this.parseBranchId(data.branchId);
        if (!branchId) {
            throw new BadRequestException('Branch is required');
        }

        const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch) {
            throw new BadRequestException('Invalid branch selection');
        }

        if (!data.departmentId) {
            throw new BadRequestException('Department is required');
        }

        const departmentLink = await this.prisma.departmentBranch.findFirst({
            where: {
                departmentId: data.departmentId,
                branchId,
            },
        });
        if (!departmentLink) {
            throw new BadRequestException('Department is not available in this branch');
        }

        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: normalizedEmail },
                    ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
                ],
            },
        });
        if (existing) {
            throw new ConflictException(existing.phone === normalizedPhone
                ? 'Employee with this phone number already exists'
                : 'Employee with this email already exists');
        }

        const employeeNumber = await this.generateEmployeeNumber();
        const username = await this.generateUniqueUsername(fullName, normalizedEmail);
        const passwordHash = await bcrypt.hash(data.password, 12);
        const governorate = this.inferGovernorateFromBranchName(branch.name);

        const user = await this.prisma.user.create({
            data: {
                employeeNumber,
                username,
                fullName,
                fullNameAr: data.fullNameAr?.trim() || null,
                email: normalizedEmail,
                phone: normalizedPhone,
                passwordHash,
                role: 'EMPLOYEE',
                governorate,
                branchId,
                departmentId: data.departmentId,
                jobTitle,
                jobTitleAr: data.jobTitleAr?.trim() || null,
                fingerprintId: employeeNumber,
                mustChangePass: false,
                workflowMode: 'SANDBOX',
            },
            include: { department: true },
        });

        await this.initializeLeaveBalances(user.id);

        await this.auditService.log({
            userId: user.id,
            action: 'EMPLOYEE_CREATED',
            entity: 'User',
            entityId: user.id,
            details: {
                employeeNumber: user.employeeNumber,
                email: user.email,
                username,
                selfRegistered: true,
                workflowMode: user.workflowMode,
            },
        });

        await this.notificationsService.createInApp({
            receiverId: user.id,
            type: 'ACCOUNT_CREATED',
            title: 'Welcome to SPHINX HR',
            titleAr: 'مرحبًا بك في SPHINX HR',
            body: 'Your account is ready in Sandbox Mode. New requests will be approved automatically.',
            bodyAr: 'حسابك جاهز في وضع التجربة. أي طلبات جديدة سيتم اعتمادها تلقائيًا.',
            metadata: { workflowMode: user.workflowMode, selfRegistered: true },
        });

        await this.notificationsService.sendAccountCreatedMessage({
            id: user.id,
            fullName: user.fullName,
            fullNameAr: user.fullNameAr,
            email: user.email,
            phone: user.phone,
            employeeNumber: user.employeeNumber,
            username: user.username,
            workflowMode: user.workflowMode,
        });

        await this.clearUserCaches();

        return user;
    }

    async create(data: CreateUserDto, createdById?: string) {
        const defaultPassword = 'SPHINX@2026';
        const normalizedEmail = data.email.trim().toLowerCase();
        const password = data.password || defaultPassword;
        const normalizedPhone = this.validatePhone(data.phone);
        const phoneLast4 = (normalizedPhone || '').slice(-4) || '0000';
        const baseName = (data.fullName || 'user').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'user';
        const generatedUsername = `${baseName}${phoneLast4}`.toLowerCase();
        const jobTitle = data.jobTitle?.trim();
        if (!jobTitle) {
            throw new BadRequestException('Job title is required');
        }

        const role = data.role || 'EMPLOYEE';
        const branchIdInput = this.parseBranchId(data.branchId);
        let branchId = branchIdInput;
        let governorate = data.governorate;
        let branch: { id: number; name: string } | null = null;

        if (branchId) {
            branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
            if (!branch) throw new BadRequestException('Invalid branch selection');
            const inferred = this.inferGovernorateFromBranchName(branch.name);
            if (inferred) governorate = inferred;
        } else if (governorate) {
            branch = await this.resolveBranchByGovernorate(governorate);
            branchId = branch?.id;
        }

        if (!branchId) {
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
                    { email: normalizedEmail },
                    { employeeNumber: data.employeeNumber },
                    { username: generatedUsername },
                    ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
                ],
            },
        });
        if (existing) {
            throw new ConflictException(existing.phone === normalizedPhone
                ? 'Employee with this phone number already exists'
                : 'Employee with this email, employee number, or username already exists');
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await this.prisma.user.create({
            data: {
                employeeNumber: data.employeeNumber,
                username: generatedUsername,
                fullName: data.fullName,
                fullNameAr: data.fullNameAr,
                email: normalizedEmail,
                phone: normalizedPhone,
                passwordHash,
                role,
                governorate,
                branchId,
                departmentId: data.departmentId,
                jobTitle,
                jobTitleAr: data.jobTitleAr,
                fingerprintId: data.fingerprintId || data.employeeNumber,
                mustChangePass: true,
                workflowMode: 'APPROVAL_WORKFLOW',
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

        await this.initializeLeaveBalances(user.id);

        await this.notificationsService.createInApp({
            receiverId: user.id,
            type: 'ACCOUNT_CREATED',
            title: 'Welcome to SPHINX HR',
            titleAr: 'مرحبًا بك في SPHINX HR',
            body: `Your account has been created. Employee #${user.employeeNumber}. Please change your password on first login.`,
            bodyAr: `تم إنشاء حسابك. رقم الموظف: ${user.employeeNumber}. يرجى تغيير كلمة المرور عند أول تسجيل دخول.`,
        });

        const deliverySummary = await this.notificationsService.sendAccountCreatedMessage({
            id: user.id,
            fullName: user.fullName,
            fullNameAr: user.fullNameAr,
            email: user.email,
            phone: user.phone,
            employeeNumber: user.employeeNumber,
            username: generatedUsername,
            workflowMode: user.workflowMode,
        }, {
            temporaryPassword: password,
            syncWhatsApp: Boolean(user.phone),
            waitForExternalDeliveries: true,
        });

        await this.clearUserCaches();

        return {
            ...user,
            generatedUsername,
            defaultPassword: password,
            whatsAppDelivery: deliverySummary.whatsAppDelivery,
            emailDelivery: deliverySummary.emailDelivery,
        };
    }

    async findAll(requesterId: string, requesterRole: string, params?: {
        departmentId?: string;
        branchId?: number;
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
        const rawSearch = params?.search?.trim() || params?.name?.trim() || '';
        const searchQuery = rawSearch.trim();
        const normalizedSearch = normalizeSearchText(searchQuery);
        const phoneDigits = normalizeDigits(searchQuery).replace(/\D/g, '');
        const isPhoneLike = phoneDigits.length >= 7 && !/[a-z\u0600-\u06FF]/i.test(normalizedSearch);
        const hasArabic = /[\u0600-\u06FF]/.test(searchQuery);

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

        if (params?.branchId) {
            where.branchId = params.branchId;
        }

        if (!searchQuery && params?.phone) {
            where.phone = { contains: params.phone, mode: 'insensitive' };
        }
        if (params?.status === 'active') where.isActive = true;
        if (params?.status === 'inactive') where.isActive = false;
        if (params?.from || params?.to) {
            const fromDate = params?.from ? startOfDay(new Date(params.from)) : undefined;
            const toDate = params?.to ? endOfDay(new Date(params.to)) : undefined;
            where.createdAt = {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
            };
        }
        const hasLetters = /[a-z\u0600-\u06FF]/i.test(normalizedSearch);
        if (searchQuery && isPhoneLike) {
            where.OR = [
                { phone: { contains: phoneDigits, mode: 'insensitive' } },
                { employeeNumber: { contains: phoneDigits, mode: 'insensitive' } },
            ];
        }

        const cacheKey = `users:${requesterRole}:${requesterId}:${JSON.stringify(params || {})}`;
        const cached = await this.redisService.getJSON<any>(cacheKey);
        if (cached) return cached;

        if (searchQuery && !isPhoneLike) {
            const numericOnly = !!phoneDigits && !hasLetters;
            const candidateWhere = numericOnly
                ? {
                    ...where,
                    OR: [
                        { phone: { contains: phoneDigits, mode: 'insensitive' } },
                        { employeeNumber: { contains: phoneDigits, mode: 'insensitive' } },
                    ],
                }
                : hasArabic
                    ? where
                    : {
                        ...where,
                        OR: [
                            { fullName: { contains: searchQuery, mode: 'insensitive' } },
                            { fullNameAr: { contains: searchQuery, mode: 'insensitive' } },
                            { employeeNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                            ...(phoneDigits
                                ? [{ phone: { contains: phoneDigits, mode: 'insensitive' } }]
                                : []),
                        ],
                    };
            const candidates = await this.prisma.user.findMany({
                where: candidateWhere,
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
            const filtered = candidates.filter((user) => matchesEmployeeSearch(searchQuery, user));
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

    async update(id: string, data: UpdateUserDto, updatedById?: string) {
        const normalizedPhone = data.phone !== undefined ? this.validatePhone(data.phone) : undefined;

        const existing = await this.prisma.user.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Employee not found');

        if (normalizedPhone && normalizedPhone !== existing.phone) {
            const duplicatePhone = await this.prisma.user.findFirst({
                where: {
                    phone: normalizedPhone,
                    id: { not: id },
                },
                select: { id: true },
            });
            if (duplicatePhone) {
                throw new ConflictException('Employee with this phone number already exists');
            }
        }

        const finalJobTitle = data.jobTitle !== undefined ? data.jobTitle?.trim() : existing.jobTitle;
        if (!finalJobTitle) {
            throw new BadRequestException('Job title is required');
        }

        const role = data.role || existing.role;
        const branchIdInput = this.parseBranchId(data.branchId);
        let branchId = existing.branchId ?? undefined;
        let governorate = existing.governorate ?? undefined;

        if (branchIdInput !== undefined) {
            branchId = branchIdInput;
            if (branchId) {
                const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
                if (!branch) throw new BadRequestException('Invalid branch selection');
                const inferred = this.inferGovernorateFromBranchName(branch.name);
                if (inferred) {
                    governorate = inferred;
                } else if (data.governorate !== undefined) {
                    governorate = data.governorate || null;
                }
            } else if (data.governorate === undefined) {
                governorate = null;
            }
        }

        if (data.governorate !== undefined && branchIdInput === undefined) {
            governorate = data.governorate || null;
            if (branchIdInput === undefined) {
                const branchFromGov = await this.resolveBranchByGovernorate(governorate);
                if (branchFromGov) branchId = branchFromGov.id;
            }
        }

        if (!branchId) {
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
            ...(data.jobTitle !== undefined && { jobTitle: finalJobTitle }),
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

        await this.clearUserCaches();

        return user;
    }

    async deletePermanently(targetUserId: string, adminId: string, adminRole: string) {
        const target = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                role: true,
                employeeNumber: true,
                fullName: true,
            },
        });
        if (!target) throw new NotFoundException('Employee not found');

        if (target.id === adminId) {
            throw new BadRequestException('You cannot delete your own account');
        }

        if (adminRole === 'HR_ADMIN' && (target.role === 'HR_ADMIN' || target.role === 'SUPER_ADMIN')) {
            throw new ForbiddenException('HR admins can only permanently delete non-admin accounts');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.department.updateMany({
                where: { managerId: targetUserId },
                data: { managerId: null },
            });

            await tx.permissionRequest.updateMany({
                where: { approvedByMgrId: targetUserId },
                data: { approvedByMgrId: null, approvedByMgrAt: null },
            });
            await tx.permissionRequest.updateMany({
                where: { approvedByHrId: targetUserId },
                data: { approvedByHrId: null, approvedByHrAt: null },
            });

            await tx.leaveRequest.updateMany({
                where: { approvedByMgrId: targetUserId },
                data: { approvedByMgrId: null, approvedByMgrAt: null },
            });
            await tx.leaveRequest.updateMany({
                where: { approvedByHrId: targetUserId },
                data: { approvedByHrId: null, approvedByHrAt: null },
            });

            await tx.formSubmission.updateMany({
                where: { approvedByMgrId: targetUserId },
                data: { approvedByMgrId: null, approvedByMgrAt: null },
            });
            await tx.formSubmission.updateMany({
                where: { approvedByHrId: targetUserId },
                data: { approvedByHrId: null, approvedByHrAt: null },
            });

            await tx.notification.deleteMany({
                where: {
                    OR: [{ receiverId: targetUserId }, { senderId: targetUserId }],
                },
            });
            await tx.message.deleteMany({
                where: {
                    OR: [{ senderId: targetUserId }, { receiverId: targetUserId }],
                },
            });
            await tx.note.deleteMany({ where: { userId: targetUserId } });
            await tx.lateness.deleteMany({ where: { userId: targetUserId } });
            await tx.permissionRequest.deleteMany({ where: { userId: targetUserId } });
            await tx.leaveRequest.deleteMany({ where: { userId: targetUserId } });
            await tx.formSubmission.deleteMany({ where: { userId: targetUserId } });
            await tx.permissionCycle.deleteMany({ where: { userId: targetUserId } });
            await tx.leaveBalance.deleteMany({ where: { userId: targetUserId } });
            await tx.refreshToken.deleteMany({ where: { userId: targetUserId } });
            await tx.auditLog.deleteMany({ where: { userId: targetUserId } });
            await tx.user.delete({ where: { id: targetUserId } });
        });

        await this.auditService.log({
            userId: adminId,
            action: 'EMPLOYEE_DELETED',
            entity: 'User',
            entityId: targetUserId,
            details: {
                permanentlyDeleted: true,
                employeeNumber: target.employeeNumber,
                fullName: target.fullName,
                role: target.role,
            },
        });

        await this.clearUserCaches();

        return { message: 'Employee deleted permanently.' };
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

        await this.clearUserCaches();

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
            const { start: cycleStart, end: cycleEnd } = this.getCycleRange(date);
            const key = this.formatCycleKey(cycleStart);
            if (cycles.has(key)) return cycles.get(key);
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
        const { start: currentStart } = this.getCycleRange(now);
        const currentKey = this.formatCycleKey(currentStart);
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


