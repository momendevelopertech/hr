import { Injectable } from '@nestjs/common';
import { addMonths, endOfDay, setDate, startOfDay } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { PdfService } from '../pdf/pdf.service';
import { matchesEmployeeSearch, normalizeDigits, normalizeSearchText } from '../shared/search-normalization';

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService, private pdfService: PdfService) { }

    private toPaging(query: any, defaultLimit = 20) {
        const page = Math.max(1, parseInt(query?.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query?.limit || String(defaultLimit), 10)));
        return { page, limit, skip: (page - 1) * limit };
    }

    private emptyPage(page: number, limit: number) {
        return { items: [], total: 0, page, limit, totalPages: 1 };
    }

    private buildDateFilter(field: string, query?: any) {
        if (!query?.from && !query?.to) return {};
        const fromDate = query?.from ? startOfDay(new Date(query.from)) : undefined;
        const toDate = query?.to ? endOfDay(new Date(query.to)) : undefined;
        return {
            [field]: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
            },
        };
    }

    private buildUserScopeWhere(query?: any, scopeUserIds?: string[] | null) {
        const userWhere: any = {
            ...(query?.departmentId ? { departmentId: query.departmentId } : {}),
            ...(query?.governorate ? { governorate: query.governorate } : {}),
        };
        if (scopeUserIds) {
            userWhere.id = { in: scopeUserIds };
        }
        return userWhere;
    }

    private async resolveEmployeeIds(employee: string | undefined, userWhere: any) {
        const raw = employee?.trim() || '';
        const normalized = normalizeSearchText(raw);
        if (!normalized) return null;
        const phoneDigits = normalizeDigits(raw).replace(/\D/g, '');
        const hasLetters = /[a-z\u0600-\u06FF]/i.test(normalized);
        const where = phoneDigits && !hasLetters
            ? {
                ...userWhere,
                OR: [
                    { phone: { contains: phoneDigits, mode: 'insensitive' } },
                    { employeeNumber: { contains: phoneDigits, mode: 'insensitive' } },
                ],
            }
            : userWhere;
        const users = await this.prisma.user.findMany({
            where,
            select: { id: true, fullName: true, fullNameAr: true, employeeNumber: true, phone: true },
        });
        return users
            .filter((user) => matchesEmployeeSearch(raw, user))
            .map((user) => user.id);
    }

    private async resolveScopeUserIds(requesterId: string, requesterRole: string) {
        if (requesterRole === 'HR_ADMIN' || requesterRole === 'SUPER_ADMIN') return null;

        if (requesterRole === 'MANAGER') {
            const manager = await this.prisma.user.findUnique({ where: { id: requesterId } });
            if (!manager?.departmentId) return [];
            const employees = await this.prisma.user.findMany({
                where: { departmentId: manager.departmentId },
                select: { id: true },
            });
            return employees.map((e) => e.id);
        }

        if (requesterRole === 'BRANCH_SECRETARY') {
            const secretary = await this.prisma.user.findUnique({ where: { id: requesterId } });
            if (!secretary?.governorate) return [];
            const employees = await this.prisma.user.findMany({
                where: { governorate: secretary.governorate },
                select: { id: true },
            });
            return employees.map((e) => e.id);
        }

        return [];
    }

    // Reporting cycle: day 11 to day 10 next month.
    private getCycleRange(date: Date) {
        const day = date.getDate();
        if (day >= 11) {
            return {
                start: startOfDay(setDate(date, 11)),
                end: endOfDay(setDate(addMonths(date, 1), 10)),
            };
        }

        const prevMonth = addMonths(date, -1);
        return {
            start: startOfDay(setDate(prevMonth, 11)),
            end: endOfDay(setDate(date, 10)),
        };
    }

    async getLeaveReport(requesterId: string, requesterRole: string, query?: any) {
        const { page, limit, skip } = this.toPaging(query, 10);
        const scopeUserIds = await this.resolveScopeUserIds(requesterId, requesterRole);
        if (scopeUserIds && scopeUserIds.length === 0) return this.emptyPage(page, limit);

        const where: any = {
            ...(query?.status ? { status: query.status } : {}),
            ...(query?.leaveType ? { leaveType: query.leaveType } : {}),
            ...this.buildDateFilter('startDate', query),
        };

        const userWhere = this.buildUserScopeWhere(query, scopeUserIds);
        const employeeIds = await this.resolveEmployeeIds(query?.employee, userWhere);

        if (query?.userId) {
            if (scopeUserIds && !scopeUserIds.includes(query.userId)) return this.emptyPage(page, limit);
            if (employeeIds && !employeeIds.includes(query.userId)) return this.emptyPage(page, limit);
            where.userId = query.userId;
        } else if (employeeIds !== null) {
            if (employeeIds.length === 0) return this.emptyPage(page, limit);
            where.userId = { in: employeeIds };
        } else if (Object.keys(userWhere).length) {
            where.user = userWhere;
        }

        const [items, total] = await Promise.all([
            this.prisma.leaveRequest.findMany({
                where,
                include: {
                    user: { select: { fullName: true, fullNameAr: true, employeeNumber: true, department: { select: { name: true, nameAr: true } } } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.leaveRequest.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    async getPermissionReport(requesterId: string, requesterRole: string, query?: any) {
        const { page, limit, skip } = this.toPaging(query, 10);
        const scopeUserIds = await this.resolveScopeUserIds(requesterId, requesterRole);
        if (scopeUserIds && scopeUserIds.length === 0) return this.emptyPage(page, limit);

        const where: any = {
            ...(query?.status ? { status: query.status } : {}),
            ...(query?.permissionType ? { permissionType: query.permissionType } : {}),
            ...this.buildDateFilter('requestDate', query),
        };

        const userWhere = this.buildUserScopeWhere(query, scopeUserIds);
        const employeeIds = await this.resolveEmployeeIds(query?.employee, userWhere);

        if (query?.userId) {
            if (scopeUserIds && !scopeUserIds.includes(query.userId)) return this.emptyPage(page, limit);
            if (employeeIds && !employeeIds.includes(query.userId)) return this.emptyPage(page, limit);
            where.userId = query.userId;
        } else if (employeeIds !== null) {
            if (employeeIds.length === 0) return this.emptyPage(page, limit);
            where.userId = { in: employeeIds };
        } else if (Object.keys(userWhere).length) {
            where.user = userWhere;
        }

        const [items, total] = await Promise.all([
            this.prisma.permissionRequest.findMany({
                where,
                include: {
                    user: { select: { fullName: true, fullNameAr: true, employeeNumber: true, department: { select: { name: true, nameAr: true } } } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.permissionRequest.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    async getFormsReport(requesterId: string, requesterRole: string, query?: any) {
        const { page, limit, skip } = this.toPaging(query, 10);
        const scopeUserIds = await this.resolveScopeUserIds(requesterId, requesterRole);
        if (scopeUserIds && scopeUserIds.length === 0) return this.emptyPage(page, limit);

        const where: any = {
            ...(query?.status ? { status: query.status } : {}),
            ...(query?.reportType
                ? {
                    form: {
                        OR: [
                            { name: { contains: query.reportType, mode: 'insensitive' } },
                            { nameAr: { contains: query.reportType, mode: 'insensitive' } },
                        ],
                    },
                }
                : {}),
            ...this.buildDateFilter('createdAt', query),
        };

        const userWhere = this.buildUserScopeWhere(query, scopeUserIds);
        const employeeIds = await this.resolveEmployeeIds(query?.employee, userWhere);

        if (query?.userId) {
            if (scopeUserIds && !scopeUserIds.includes(query.userId)) return this.emptyPage(page, limit);
            if (employeeIds && !employeeIds.includes(query.userId)) return this.emptyPage(page, limit);
            where.userId = query.userId;
        } else if (employeeIds !== null) {
            if (employeeIds.length === 0) return this.emptyPage(page, limit);
            where.userId = { in: employeeIds };
        } else if (Object.keys(userWhere).length) {
            where.user = userWhere;
        }

        const [items, total] = await Promise.all([
            this.prisma.formSubmission.findMany({
                where,
                include: {
                    form: { select: { name: true, nameAr: true } },
                    user: { select: { fullName: true, fullNameAr: true, employeeNumber: true, department: { select: { name: true, nameAr: true } } } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.formSubmission.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    async getEmployeeSummary(requesterId: string, requesterRole: string, query?: any) {
        const { page, limit, skip } = this.toPaging(query, 20);
        const scopeUserIds = await this.resolveScopeUserIds(requesterId, requesterRole);
        if (scopeUserIds && scopeUserIds.length === 0) return this.emptyPage(page, limit);

        const employee = query?.employee?.trim();
        const userWhere = this.buildUserScopeWhere(query, scopeUserIds);
        let users: any[] = [];
        let total = 0;

        if (employee) {
            const candidates = await this.prisma.user.findMany({
                where: userWhere,
                orderBy: { fullName: 'asc' },
                select: {
                    id: true,
                    fullName: true,
                    fullNameAr: true,
                    employeeNumber: true,
                    phone: true,
                    department: { select: { name: true, nameAr: true } },
                },
            });
            const filtered = candidates.filter((user) => matchesEmployeeSearch(employee, user));
            total = filtered.length;
            users = filtered.slice(skip, skip + limit);
        } else {
            const result = await Promise.all([
                this.prisma.user.findMany({
                    where: userWhere,
                    skip,
                    take: limit,
                    orderBy: { fullName: 'asc' },
                    select: {
                        id: true,
                        fullName: true,
                        fullNameAr: true,
                        employeeNumber: true,
                        phone: true,
                        department: { select: { name: true, nameAr: true } },
                    },
                }),
                this.prisma.user.count({ where: userWhere }),
            ]);
            users = result[0];
            total = result[1];
        }

        if (users.length === 0) {
            return { items: [], total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
        }

        const userIds = users.map((user) => user.id);
        const leaveWhere: any = {
            userId: { in: userIds },
            ...(query?.status ? { status: query.status } : {}),
            ...this.buildDateFilter('startDate', query),
        };
        const permissionWhere: any = {
            userId: { in: userIds },
            ...(query?.status ? { status: query.status } : {}),
            ...this.buildDateFilter('requestDate', query),
        };

        const [leaveCounts, permissionCounts] = await Promise.all([
            this.prisma.leaveRequest.groupBy({
                by: ['userId', 'leaveType'],
                where: leaveWhere,
                _count: { _all: true },
            }),
            this.prisma.permissionRequest.groupBy({
                by: ['userId'],
                where: permissionWhere,
                _count: { _all: true },
            }),
        ]);

        const countsByUser = new Map<string, any>();

        leaveCounts.forEach((item) => {
            const entry = countsByUser.get(item.userId) || {
                annual: 0,
                casual: 0,
                mission: 0,
                absence: 0,
                emergency: 0,
            };
            if (item.leaveType === 'ANNUAL') entry.annual = item._count._all;
            else if (item.leaveType === 'CASUAL') entry.casual = item._count._all;
            else if (item.leaveType === 'MISSION') entry.mission = item._count._all;
            else if (item.leaveType === 'ABSENCE_WITH_PERMISSION') entry.absence = item._count._all;
            else if (item.leaveType === 'EMERGENCY') entry.emergency = item._count._all;
            countsByUser.set(item.userId, entry);
        });

        permissionCounts.forEach((item) => {
            const entry = countsByUser.get(item.userId) || {
                annual: 0,
                casual: 0,
                mission: 0,
                absence: 0,
                emergency: 0,
            };
            entry.permissions = item._count._all;
            countsByUser.set(item.userId, entry);
        });

        const items = users.map((user) => {
            const counts = countsByUser.get(user.id) || {
                annual: 0,
                casual: 0,
                mission: 0,
                absence: 0,
                emergency: 0,
                permissions: 0,
            };
            const { phone: _phone, ...safeUser } = user;
            return {
                ...safeUser,
                counts: {
                    annual: counts.annual ?? 0,
                    casual: counts.casual ?? 0,
                    mission: counts.mission ?? 0,
                    absence: counts.absence ?? 0,
                    emergency: counts.emergency ?? 0,
                    permissions: counts.permissions ?? 0,
                },
            };
        });

        return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    private resolvePendingStage(status: string, approvedByMgrId?: string | null) {
        if (status === 'PENDING') return 'WAITING_SECRETARY';
        if (status === 'MANAGER_APPROVED' && !approvedByMgrId) return 'WAITING_MANAGER';
        if (status === 'MANAGER_APPROVED' && approvedByMgrId) return 'WAITING_HR';
        return 'UNKNOWN';
    }

    async getPendingRequests(requesterId: string, requesterRole: string, query?: any) {
        const { page, limit, skip } = this.toPaging(query, 20);
        const scopeUserIds = await this.resolveScopeUserIds(requesterId, requesterRole);
        if (scopeUserIds && scopeUserIds.length === 0) return this.emptyPage(page, limit);

        const baseStatus = { status: { in: ['PENDING', 'MANAGER_APPROVED'] } };
        const leaveWhere: any = {
            ...baseStatus,
            ...this.buildDateFilter('createdAt', query),
        };
        const permissionWhere: any = {
            ...baseStatus,
            ...this.buildDateFilter('createdAt', query),
        };

        const userWhere = this.buildUserScopeWhere(query, scopeUserIds);
        const employeeIds = await this.resolveEmployeeIds(query?.employee, userWhere);

        if (query?.userId) {
            if (scopeUserIds && !scopeUserIds.includes(query.userId)) return this.emptyPage(page, limit);
            if (employeeIds && !employeeIds.includes(query.userId)) return this.emptyPage(page, limit);
            leaveWhere.userId = query.userId;
            permissionWhere.userId = query.userId;
        } else if (employeeIds !== null) {
            if (employeeIds.length === 0) return this.emptyPage(page, limit);
            leaveWhere.userId = { in: employeeIds };
            permissionWhere.userId = { in: employeeIds };
        } else if (Object.keys(userWhere).length) {
            leaveWhere.user = userWhere;
            permissionWhere.user = userWhere;
        }

        const [leaveItems, permissionItems] = await Promise.all([
            this.prisma.leaveRequest.findMany({
                where: leaveWhere,
                select: {
                    id: true,
                    leaveType: true,
                    status: true,
                    approvedByMgrId: true,
                    createdAt: true,
                    startDate: true,
                    user: { select: { fullName: true, fullNameAr: true, employeeNumber: true, department: { select: { name: true, nameAr: true } } } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.permissionRequest.findMany({
                where: permissionWhere,
                select: {
                    id: true,
                    permissionType: true,
                    status: true,
                    approvedByMgrId: true,
                    createdAt: true,
                    requestDate: true,
                    user: { select: { fullName: true, fullNameAr: true, employeeNumber: true, department: { select: { name: true, nameAr: true } } } },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        const merged = [
            ...leaveItems.map((item) => ({
                id: item.id,
                requestType: 'leave',
                leaveType: item.leaveType,
                status: item.status,
                stage: this.resolvePendingStage(item.status, item.approvedByMgrId),
                createdAt: item.createdAt,
                requestDate: item.startDate,
                user: item.user,
            })),
            ...permissionItems.map((item) => ({
                id: item.id,
                requestType: 'permission',
                permissionType: item.permissionType,
                status: item.status,
                stage: this.resolvePendingStage(item.status, item.approvedByMgrId),
                createdAt: item.createdAt,
                requestDate: item.requestDate,
                user: item.user,
            })),
        ]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const total = merged.length;
        const paged = merged.slice(skip, skip + limit);

        return { items: paged, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    async getMonthlySummary(requesterId: string, requesterRole: string) {
        const scopeUserIds = await this.resolveScopeUserIds(requesterId, requesterRole);
        if (scopeUserIds && scopeUserIds.length === 0) {
            return { cycleStart: null, cycleEnd: null, totals: { leaves: 0, permissions: 0, missions: 0, absences: 0 } };
        }

        const now = new Date();
        const { start: cycleStart, end: cycleEnd } = this.getCycleRange(now);

        const leaveScope: any = {
            startDate: { gte: cycleStart, lte: cycleEnd },
        };
        const permissionScope: any = {
            requestDate: { gte: cycleStart, lte: cycleEnd },
        };

        if (scopeUserIds) {
            leaveScope.userId = { in: scopeUserIds };
            permissionScope.userId = { in: scopeUserIds };
        }

        const [leaves, missions, absences, permissions] = await Promise.all([
            this.prisma.leaveRequest.count({
                where: {
                    ...leaveScope,
                    leaveType: { in: ['ANNUAL', 'CASUAL', 'EMERGENCY'] },
                },
            }),
            this.prisma.leaveRequest.count({
                where: {
                    ...leaveScope,
                    leaveType: 'MISSION',
                },
            }),
            this.prisma.leaveRequest.count({
                where: {
                    ...leaveScope,
                    leaveType: 'ABSENCE_WITH_PERMISSION',
                },
            }),
            this.prisma.permissionRequest.count({ where: permissionScope }),
        ]);

        return {
            cycleStart,
            cycleEnd,
            totals: {
                leaves,
                permissions,
                missions,
                absences,
            },
        };
    }

    async exportLeaveReportToExcel(requesterId: string, requesterRole: string, filters?: any): Promise<Buffer> {
        const data = await this.getLeaveReport(requesterId, requesterRole, { ...filters, page: 1, limit: 10000 });
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Leave Report');

        sheet.columns = [
            { header: 'Employee', key: 'employee', width: 25 },
            { header: 'Emp. #', key: 'empNum', width: 15 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Leave Type', key: 'leaveType', width: 15 },
            { header: 'Start Date', key: 'startDate', width: 15 },
            { header: 'End Date', key: 'endDate', width: 15 },
            { header: 'Days', key: 'days', width: 10 },
            { header: 'Status', key: 'status', width: 20 },
            { header: 'Reason', key: 'reason', width: 30 },
        ];

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };

        data.items.forEach((row: any) => {
            sheet.addRow({
                employee: row.user?.fullName,
                empNum: row.user?.employeeNumber,
                dept: row.user?.department?.name,
                leaveType: row.leaveType,
                startDate: new Date(row.startDate).toLocaleDateString(),
                endDate: new Date(row.endDate).toLocaleDateString(),
                days: row.totalDays,
                status: row.status,
                reason: row.reason,
            });
        });

        const arrayBuffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(arrayBuffer);
    }

    async exportPermissionReportToExcel(requesterId: string, requesterRole: string, filters?: any): Promise<Buffer> {
        const data = await this.getPermissionReport(requesterId, requesterRole, { ...filters, page: 1, limit: 10000 });
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Permission Report');

        sheet.columns = [
            { header: 'Employee', key: 'employee', width: 25 },
            { header: 'Emp. #', key: 'empNum', width: 15 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Hours', key: 'hours', width: 10 },
            { header: 'Status', key: 'status', width: 20 },
        ];

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };

        data.items.forEach((row: any) => {
            sheet.addRow({
                employee: row.user?.fullName,
                empNum: row.user?.employeeNumber,
                dept: row.user?.department?.name,
                type: row.permissionType,
                date: new Date(row.requestDate).toLocaleDateString(),
                hours: row.hoursUsed,
                status: row.status,
            });
        });

        const arrayBuffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(arrayBuffer);
    }
}
