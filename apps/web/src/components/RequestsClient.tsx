'use client';

import { addMonths } from 'date-fns';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import api, { isAuthError } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import { enumLabels } from '@/lib/enum-labels';
import { usePusherChannel } from '@/lib/use-pusher-channel';
import { normalizeSearchText } from '@/lib/search-normalization';
import PageLoader from './PageLoader';
import EmployeeHistoryModal from './EmployeeHistoryModal';
import ConfirmDialog from './ConfirmDialog';
import DateRangeFilter from './DateRangeFilter';

type Department = { id: string; name: string; nameAr?: string | null };
type RequestUser = {
    fullName: string;
    fullNameAr?: string | null;
    employeeNumber: string;
    governorate?: 'CAIRO' | 'ALEXANDRIA' | null;
    department?: Department | null;
};

type LeaveRequest = {
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    createdAt: string;
    status: string;
    approvedByMgrId?: string | null;
    user: RequestUser;
};

type PermissionRequest = {
    id: string;
    permissionType: string;
    requestDate: string;
    createdAt: string;
    hoursUsed: number;
    status: string;
    approvedByMgrId?: string | null;
    user: RequestUser;
};

type RequestRow = {
    id: string;
    requestType: 'leave' | 'permission';
    leaveType?: string;
    subtype: string;
    employeeName: string;
    employeeNameAlt?: string | null;
    employeeNumber: string;
    requestDate: string;
    requestDateTs: number;
    createdAt: string;
    createdAtTs: number;
    status: string;
    details: string;
    printUrl: string;
    approvedByMgrId?: string | null;
    employeeGovernorate?: 'CAIRO' | 'ALEXANDRIA' | null;
    employeeDepartmentId?: string | null;
    searchKey: string;
};

type LatenessItem = {
    id: string;
    date: string;
    minutesLate: number;
    convertedToPermission: boolean;
    permissionId?: string | null;
};

type LatenessResponse = {
    items: LatenessItem[];
    totalCount: number;
    totalMinutes: number;
    deductionDays: number;
    cycleStart: string;
    cycleEnd: string;
};

const LATENESS_STALE_MS = 30000;

export default function RequestsClient({ locale }: { locale: string }) {
    const t = useTranslations('requestsPage');
    const tEmployees = useTranslations('employees');
    const tCommon = useTranslations('common');
    const { user, ready } = useRequireAuth(locale);
    const role = user?.role;
    const isSecretary = role === 'BRANCH_SECRETARY';
    const isManager = role === 'MANAGER';
    const isHr = role === 'HR_ADMIN' || role === 'SUPER_ADMIN';
    const canManage = isHr || isManager || isSecretary;
    const canAdmin = isHr;
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [latenessItems, setLatenessItems] = useState<LatenessItem[]>([]);
    const [latenessSummary, setLatenessSummary] = useState({
        totalCount: 0,
        totalMinutes: 0,
        deductionDays: 0,
        cycleStart: '',
        cycleEnd: '',
    });
    const [latenessLoading, setLatenessLoading] = useState(false);
    const [cycleBaseDate, setCycleBaseDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'leave' | 'absence' | 'mission' | 'permission' | 'lateness'>('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [filters, setFilters] = useState({
        status: '',
        search: '',
        from: '',
        to: '',
        governorate: '',
        departmentId: '',
    });
    const deferredSearch = useDeferredValue(filters.search);
    const [pendingDelete, setPendingDelete] = useState<RequestRow | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [salary, setSalary] = useState('');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [, startTabTransition] = useTransition();

    const dateLocale = useMemo(() => (locale === 'ar' ? 'ar-EG' : 'en-US'), [locale]);

    const refreshInFlight = useRef(false);
    const latenessFetchMetaRef = useRef<{ key: string | null; timestamp: number }>({ key: null, timestamp: 0 });
    const latenessInFlightRef = useRef(false);

    const backgroundConfig = useMemo(() => ({ headers: { 'x-skip-activity': '1' } }), []);

    const refreshAll = useCallback(async (skipActivity = false) => {
        if (refreshInFlight.current) return;
        refreshInFlight.current = true;
        try {
            const config = skipActivity ? backgroundConfig : undefined;
            const [leaveReqs, permissionReqs] = await Promise.all([
                api.get('/leaves', config),
                api.get('/permissions', config),
            ]);
            setLeaves(leaveReqs.data);
            setPermissions(permissionReqs.data);
        } catch (error) {
            if (isAuthError(error)) return;
        } finally {
            refreshInFlight.current = false;
        }
    }, [backgroundConfig]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            await refreshAll();
        } finally {
            setLoading(false);
        }
    }, [refreshAll]);

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [fetchAll, ready]);

    const fetchDepartments = useCallback(async () => {
        if (!canAdmin) return;
        try {
            const res = await api.get('/departments');
            const items = Array.isArray(res.data)
                ? res.data.map((dept: Department) => ({
                    id: dept.id,
                    name: dept.name,
                    nameAr: dept.nameAr ?? null,
                }))
                : [];
            setDepartments(items);
        } catch (error) {
            if (isAuthError(error)) return;
        }
    }, [canAdmin]);

    useEffect(() => {
        if (!ready || !canAdmin) return;
        fetchDepartments();
    }, [canAdmin, fetchDepartments, ready]);

    const notificationHandlers = useMemo(
        () => ({
            notification: () => refreshAll(true),
        }),
        [refreshAll],
    );

    usePusherChannel(user ? `user-${user.id}` : null, notificationHandlers);

    useEffect(() => {
        if (!ready) return;
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            refreshAll(true);
        }, 60000);
        return () => clearInterval(interval);
    }, [ready, refreshAll]);

    const formatDateOnly = (value: Date) => {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getCycleRange = (value: Date) => {
        const day = value.getDate();
        let start: Date;
        let end: Date;

        if (day >= 11) {
            start = new Date(value.getFullYear(), value.getMonth(), 11);
            end = new Date(value.getFullYear(), value.getMonth() + 1, 10);
        } else {
            start = new Date(value.getFullYear(), value.getMonth() - 1, 11);
            end = new Date(value.getFullYear(), value.getMonth(), 10);
        }

        return { start, end };
    };

    const fetchLateness = useCallback(async (force = false) => {
        if (latenessInFlightRef.current) return;
        const { start, end } = getCycleRange(cycleBaseDate);
        const rangeKey = `${formatDateOnly(start)}:${formatDateOnly(end)}`;
        const now = Date.now();
        if (
            !force
            && latenessFetchMetaRef.current.key === rangeKey
            && now - latenessFetchMetaRef.current.timestamp < LATENESS_STALE_MS
        ) {
            return;
        }
        latenessInFlightRef.current = true;
        setLatenessLoading(true);
        try {
            const res = await api.get<LatenessResponse>('/lateness', {
                params: {
                    from: formatDateOnly(start),
                    to: formatDateOnly(end),
                },
            });
            setLatenessItems(res.data.items || []);
            setLatenessSummary({
                totalCount: res.data.totalCount || 0,
                totalMinutes: res.data.totalMinutes || 0,
                deductionDays: res.data.deductionDays || 0,
                cycleStart: res.data.cycleStart,
                cycleEnd: res.data.cycleEnd,
            });
            latenessFetchMetaRef.current = { key: rangeKey, timestamp: now };
        } catch (error) {
            if (isAuthError(error)) return;
        } finally {
            latenessInFlightRef.current = false;
            setLatenessLoading(false);
        }
    }, [cycleBaseDate]);

    useEffect(() => {
        if (!ready) return;
        fetchLateness();
    }, [fetchLateness, ready]);

    const convertLateness = async (id: string) => {
        await api.post(`/lateness/${id}/convert`);
        await fetchLateness(true);
    };

    const approveLeave = (id: string) => api.patch(`/leaves/${id}/approve`).then(fetchAll);
    const rejectLeave = (id: string) => api.patch(`/leaves/${id}/reject`).then(fetchAll);
    const cancelLeave = (id: string) => api.patch(`/leaves/${id}/cancel`).then(fetchAll);
    const deleteLeave = (id: string) => api.delete(`/leaves/${id}`).then(fetchAll);

    const approvePermission = (id: string) => api.patch(`/permissions/${id}/approve`).then(fetchAll);
    const rejectPermission = (id: string) => api.patch(`/permissions/${id}/reject`).then(fetchAll);
    const cancelPermission = (id: string) => api.patch(`/permissions/${id}/cancel`).then(fetchAll);
    const deletePermission = (id: string) => api.delete(`/permissions/${id}`).then(fetchAll);

    const leaveRows = useMemo<RequestRow[]>(
        () =>
            leaves.map((leave) => {
                const primaryName = locale === 'ar' ? leave.user.fullNameAr || leave.user.fullName : leave.user.fullName;
                const altName = locale === 'ar' ? leave.user.fullName : leave.user.fullNameAr || '';
                const subtype = enumLabels.leaveType(leave.leaveType, locale as 'en' | 'ar');
                const searchKey = normalizeSearchText(`${primaryName} ${altName || ''} ${leave.user.employeeNumber} ${subtype}`);
                const requestDateTs = new Date(leave.startDate).getTime();
                const createdAtTs = new Date(leave.createdAt).getTime();
                return {
                    id: leave.id,
                    requestType: 'leave',
                    leaveType: leave.leaveType,
                    subtype,
                    employeeName: primaryName,
                    employeeNameAlt: altName || null,
                    employeeNumber: leave.user.employeeNumber,
                    requestDate: leave.startDate,
                    requestDateTs,
                    createdAt: leave.createdAt,
                    createdAtTs,
                    status: leave.status,
                    details: `${new Date(leave.startDate).toLocaleDateString(dateLocale)} - ${new Date(leave.endDate).toLocaleDateString(dateLocale)}`,
                    printUrl: `/${locale}/requests/print/leave/${leave.id}`,
                    approvedByMgrId: leave.approvedByMgrId,
                    employeeGovernorate: leave.user.governorate ?? null,
                    employeeDepartmentId: leave.user.department?.id ?? null,
                    searchKey,
                };
            }),
        [dateLocale, leaves, locale],
    );

    const permissionRows = useMemo<RequestRow[]>(
        () =>
            permissions.map((perm) => {
                const primaryName = locale === 'ar' ? perm.user.fullNameAr || perm.user.fullName : perm.user.fullName;
                const altName = locale === 'ar' ? perm.user.fullName : perm.user.fullNameAr || '';
                const subtype = enumLabels.permissionType(perm.permissionType, locale as 'en' | 'ar');
                const searchKey = normalizeSearchText(`${primaryName} ${altName || ''} ${perm.user.employeeNumber} ${subtype}`);
                const requestDateTs = new Date(perm.requestDate).getTime();
                const createdAtTs = new Date(perm.createdAt).getTime();
                return {
                    id: perm.id,
                    requestType: 'permission',
                    subtype,
                    employeeName: primaryName,
                    employeeNameAlt: altName || null,
                    employeeNumber: perm.user.employeeNumber,
                    requestDate: perm.requestDate,
                    requestDateTs,
                    createdAt: perm.createdAt,
                    createdAtTs,
                    status: perm.status,
                    details: `${perm.hoursUsed}h`,
                    printUrl: `/${locale}/requests/print/permission/${perm.id}`,
                    approvedByMgrId: perm.approvedByMgrId,
                    employeeGovernorate: perm.user.governorate ?? null,
                    employeeDepartmentId: perm.user.department?.id ?? null,
                    searchKey,
                };
            }),
        [locale, permissions],
    );

    const leaveOnlyRows = useMemo(
        () => leaveRows.filter((row) => row.leaveType && !['ABSENCE_WITH_PERMISSION', 'MISSION'].includes(row.leaveType)),
        [leaveRows],
    );
    const absenceRows = useMemo(
        () => leaveRows.filter((row) => row.leaveType === 'ABSENCE_WITH_PERMISSION'),
        [leaveRows],
    );
    const missionRows = useMemo(
        () => leaveRows.filter((row) => row.leaveType === 'MISSION'),
        [leaveRows],
    );

    const rowsByTab = useMemo(
        () => ({
            all: [...permissionRows, ...leaveOnlyRows, ...absenceRows, ...missionRows],
            leave: leaveOnlyRows,
            absence: absenceRows,
            mission: missionRows,
            permission: permissionRows,
            lateness: [] as RequestRow[],
        }),
        [absenceRows, leaveOnlyRows, missionRows, permissionRows],
    );

    const sortedRowsByTab = useMemo(() => {
        const sortByCreatedAt = (rows: RequestRow[]) => rows.slice().sort((a, b) => b.createdAtTs - a.createdAtTs);
        return {
            all: sortByCreatedAt([...permissionRows, ...leaveOnlyRows, ...absenceRows, ...missionRows]),
            leave: sortByCreatedAt(leaveOnlyRows),
            absence: sortByCreatedAt(absenceRows),
            mission: sortByCreatedAt(missionRows),
            permission: sortByCreatedAt(permissionRows),
            lateness: [] as RequestRow[],
        };
    }, [absenceRows, leaveOnlyRows, missionRows, permissionRows]);

    const applyFilters = useCallback((rows: RequestRow[]) => {
        const normalizedQuery = deferredSearch ? normalizeSearchText(deferredSearch) : '';
        const fromTs = filters.from ? new Date(filters.from).getTime() : null;
        const toTs = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : null;
        return rows.filter((row) => {
            const statusOk = !filters.status || row.status === filters.status;
            const searchOk = !normalizedQuery || row.searchKey.includes(normalizedQuery);
            const fromOk = !fromTs || row.requestDateTs >= fromTs;
            const toOk = !toTs || row.requestDateTs <= toTs;
            const governorateOk = !filters.governorate || row.employeeGovernorate === filters.governorate;
            const departmentOk = !filters.departmentId || row.employeeDepartmentId === filters.departmentId;
            return statusOk && searchOk && fromOk && toOk && governorateOk && departmentOk;
        });
    }, [deferredSearch, filters.departmentId, filters.from, filters.governorate, filters.status, filters.to]);

    const filteredRowsByTab = useMemo(() => ({
        all: applyFilters(sortedRowsByTab.all),
        leave: applyFilters(sortedRowsByTab.leave),
        absence: applyFilters(sortedRowsByTab.absence),
        mission: applyFilters(sortedRowsByTab.mission),
        permission: applyFilters(sortedRowsByTab.permission),
        lateness: [] as RequestRow[],
    }), [applyFilters, sortedRowsByTab]);

    const filteredRows = filteredRowsByTab[activeTab] || [];

    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pagedRows = useMemo(() => filteredRows.slice((page - 1) * limit, page * limit), [filteredRows, limit, page]);

    useEffect(() => {
        setPage(1);
    }, [activeTab, filters.departmentId, filters.from, filters.governorate, filters.search, filters.status, filters.to, limit]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    useEffect(() => {
        if (!ready) return;
        if (activeTab === 'lateness') {
            fetchLateness();
        }
    }, [activeTab, fetchLateness, ready]);

    const onApprove = (row: RequestRow) => {
        if (row.requestType === 'leave') return approveLeave(row.id);
        return approvePermission(row.id);
    };

    const onReject = (row: RequestRow) => {
        if (row.requestType === 'leave') return rejectLeave(row.id);
        return rejectPermission(row.id);
    };

    const onCancel = (row: RequestRow) => {
        if (row.requestType === 'leave') return cancelLeave(row.id);
        return cancelPermission(row.id);
    };

    const onDelete = (row: RequestRow) => {
        setPendingDelete(row);
    };

    const confirmDelete = async () => {
        if (!pendingDelete || deleteBusy) return;
        setDeleteBusy(true);
        try {
            if (pendingDelete.requestType === 'leave') {
                await deleteLeave(pendingDelete.id);
            } else {
                await deletePermission(pendingDelete.id);
            }
        } finally {
            setDeleteBusy(false);
            setPendingDelete(null);
        }
    };

    const isCurrentCycle = useMemo(() => {
        const current = getCycleRange(new Date());
        const selected = getCycleRange(cycleBaseDate);
        return formatDateOnly(current.start) === formatDateOnly(selected.start);
    }, [cycleBaseDate]);

    if (!ready || loading) {
        return <PageLoader text={t('loading')} />;
    }

    const tabs: Array<{ key: 'all' | 'leave' | 'permission' | 'absence' | 'mission' | 'lateness'; label: string; count: number }> = [
        { key: 'all', label: t('tabAll'), count: rowsByTab.all.length },
        { key: 'permission', label: t('tabPermission'), count: permissionRows.length },
        { key: 'leave', label: t('tabLeave'), count: leaveOnlyRows.length },
        { key: 'absence', label: t('tabAbsence'), count: absenceRows.length },
        { key: 'mission', label: t('tabMission'), count: missionRows.length },
        { key: 'lateness', label: t('tabLateness'), count: latenessSummary.totalCount },
    ];


    const tableAlignClass = locale === 'ar' ? 'text-right' : 'text-left';
    const formatDateOnlyFromIso = (value?: string) => {
        if (!value) return '';
        const datePart = value.split('T')[0];
        const [year, month, day] = datePart.split('-').map((part) => Number(part));
        if (!year || !month || !day) return new Date(value).toLocaleDateString(dateLocale);
        return new Date(year, month - 1, day).toLocaleDateString(dateLocale);
    };
    const cycleLabel = latenessSummary.cycleStart && latenessSummary.cycleEnd
        ? `${formatDateOnlyFromIso(latenessSummary.cycleStart)} - ${formatDateOnlyFromIso(latenessSummary.cycleEnd)}`
        : '';
    const salaryValue = Number(salary) || 0;
    const estimatedDeduction = salaryValue > 0 ? (salaryValue / 30) * (latenessSummary.deductionDays || 0) : 0;
    const netSalary = salaryValue > 0 ? Math.max(0, salaryValue - estimatedDeduction) : 0;

    return (
        <main className="px-4 pb-12 sm:px-6">
            <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{t('title')}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <button className="btn-outline" onClick={() => setHistoryOpen(true)}>
                            {tEmployees('history')}
                        </button>
                        <label className="text-sm">
                            {t('rowsPerPage')}
                            <select
                                className="ms-2 rounded-lg border border-ink/20 px-2 py-1"
                                value={limit}
                                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                            >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </label>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            className={`btn-outline ${activeTab === tab.key ? 'bg-ink/10' : ''}`}
                            onClick={() => startTabTransition(() => setActiveTab(tab.key))}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {activeTab !== 'lateness' && (
                    <div className={`mt-4 grid gap-2 md:grid-cols-2 ${canAdmin ? 'xl:grid-cols-7' : 'xl:grid-cols-5'}`}>
                        <input
                            className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                            placeholder={t('search')}
                            value={filters.search}
                            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                        />
                        <select
                            className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={filters.status}
                            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                        >
                            <option value="">{t('allStatuses')}</option>
                            <option value="PENDING">{enumLabels.status('PENDING', locale as 'en' | 'ar', { requestType: 'leave' })}</option>
                            <option value="MANAGER_APPROVED">{enumLabels.status('MANAGER_APPROVED', locale as 'en' | 'ar')}</option>
                            <option value="HR_APPROVED">{enumLabels.status('HR_APPROVED', locale as 'en' | 'ar')}</option>
                            <option value="REJECTED">{enumLabels.status('REJECTED', locale as 'en' | 'ar')}</option>
                            <option value="CANCELLED">{enumLabels.status('CANCELLED', locale as 'en' | 'ar')}</option>
                        </select>
                        {canAdmin && (
                            <select
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                value={filters.governorate}
                                onChange={(e) => setFilters((prev) => ({ ...prev, governorate: e.target.value }))}
                            >
                                <option value="">{t('allBranches')}</option>
                                <option value="CAIRO">{tEmployees('govCairo')}</option>
                                <option value="ALEXANDRIA">{tEmployees('govAlexandria')}</option>
                            </select>
                        )}
                        {canAdmin && (
                            <select
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                value={filters.departmentId}
                                onChange={(e) => setFilters((prev) => ({ ...prev, departmentId: e.target.value }))}
                            >
                                <option value="">{t('allDepartments')}</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {locale === 'ar' ? dept.nameAr || dept.name : dept.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <DateRangeFilter
                            locale={locale}
                            from={filters.from}
                            to={filters.to}
                            onChange={({ from, to }) => setFilters((prev) => ({ ...prev, from, to }))}
                        />
                        <button
                            className="btn-outline"
                            onClick={() => setFilters({ status: '', search: '', from: '', to: '', governorate: '', departmentId: '' })}
                        >
                            {t('resetFilters')}
                        </button>
                    </div>
                )}

                {activeTab !== 'lateness' ? (
                    <div className="mt-4 overflow-x-auto">
                        <table className={`min-w-[980px] w-full text-sm ${tableAlignClass}`}>
                            <thead className={tableAlignClass}>
                                <tr className="border-b border-ink/10">
                                    <th className="py-2">{t('employee')}</th>
                                    <th className="py-2">{t('requestType')}</th>
                                    <th className="py-2">{t('details')}</th>
                                    <th className="py-2">{t('date')}</th>
                                    <th className="py-2">{t('status')}</th>
                                    <th className="py-2">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className={tableAlignClass}>
                                {pagedRows.map((row) => (
                                    <tr key={`${row.requestType}-${row.id}`} className="border-b border-ink/5">
                                        <td className="py-2">
                                            <p className="font-medium">{row.employeeName}</p>
                                            <p className="text-xs text-ink/60">#{row.employeeNumber}</p>
                                        </td>
                                        <td className="py-2">{row.subtype}</td>
                                        <td className="py-2">{row.details}</td>
                                        <td className="py-2">{new Date(row.requestDate).toLocaleDateString(dateLocale)}</td>
                                        <td className="py-2">
                                            <span className="pill bg-ink/10 text-ink">
                                                {enumLabels.status(row.status, locale as 'en' | 'ar', {
                                                    requestType: row.requestType,
                                                    approvedByMgrId: row.approvedByMgrId,
                                                })}
                                            </span>
                                        </td>
                                        <td className="py-2">
                                            <div className="flex flex-wrap gap-2">
                                                <a
                                                    className={`btn-outline ${row.status === 'HR_APPROVED' ? '' : 'opacity-50 cursor-not-allowed'}`}
                                                    href={row.printUrl}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    aria-disabled={row.status !== 'HR_APPROVED'}
                                                    tabIndex={row.status === 'HR_APPROVED' ? undefined : -1}
                                                    onClick={(event) => {
                                                        if (row.status !== 'HR_APPROVED') {
                                                            event.preventDefault();
                                                        }
                                                    }}
                                                >
                                                    {t('printPdf')}
                                                </a>
                                                {row.status === 'PENDING' && (
                                                    <button className="btn-outline" onClick={() => onCancel(row)}>
                                                        {t('cancel')}
                                                    </button>
                                                )}
                                                {canManage && (
                                                    <>
                                                        {((isSecretary && row.status === 'PENDING') ||
                                                            (isManager && row.status === 'MANAGER_APPROVED' && !row.approvedByMgrId) ||
                                                            (isHr && row.status === 'MANAGER_APPROVED' && !!row.approvedByMgrId)) && (
                                                            <button className="btn-primary" onClick={() => onApprove(row)}>
                                                                {isSecretary ? t('verify') : t('approve')}
                                                            </button>
                                                        )}
                                                        {((isSecretary && row.status === 'PENDING') ||
                                                            (isManager && row.status === 'MANAGER_APPROVED' && !row.approvedByMgrId) ||
                                                            (isHr && row.status === 'MANAGER_APPROVED' && !!row.approvedByMgrId)) && (
                                                            <button className="btn-secondary" onClick={() => onReject(row)}>
                                                                {t('reject')}
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                {canAdmin && ['PENDING', 'REJECTED', 'CANCELLED'].includes(row.status) && (
                                                    <button className="btn-outline" onClick={() => onDelete(row)}>
                                                        {t('delete')}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {pagedRows.length === 0 && (
                                    <tr>
                                        <td className="py-6 text-center text-ink/60" colSpan={6}>
                                            {t('noResults')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-ink/10 bg-white/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-base font-semibold">{t('latenessTitle')}</h3>
                                <div className="flex flex-wrap items-center gap-2">
                                    {cycleLabel && <span className="text-sm text-ink/60">{t('latenessCycle', { range: cycleLabel })}</span>}
                                    <button className="btn-outline text-xs" onClick={() => setCycleBaseDate(addMonths(cycleBaseDate, -1))}>
                                        {t('prevCycle')}
                                    </button>
                                    <button className="btn-outline text-xs" onClick={() => setCycleBaseDate(new Date())} disabled={isCurrentCycle}>
                                        {t('currentCycle')}
                                    </button>
                                    <button className="btn-outline text-xs" onClick={() => setCycleBaseDate(addMonths(cycleBaseDate, 1))} disabled={isCurrentCycle}>
                                        {t('nextCycle')}
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-4">
                                <div className="rounded-xl border border-ink/10 bg-white p-3">
                                    <p className="text-xs text-ink/60">{t('latenessCount')}</p>
                                    <p className="text-lg font-semibold">{latenessSummary.totalCount}</p>
                                </div>
                                <div className="rounded-xl border border-ink/10 bg-white p-3">
                                    <p className="text-xs text-ink/60">{t('latenessMinutes')}</p>
                                    <p className="text-lg font-semibold">{latenessSummary.totalMinutes}</p>
                                </div>
                                <div className="rounded-xl border border-ink/10 bg-white p-3">
                                    <p className="text-xs text-ink/60">{t('latenessDeduction')}</p>
                                    <p className="text-lg font-semibold">{latenessSummary.deductionDays}</p>
                                </div>
                                <div className="rounded-xl border border-ink/10 bg-white p-3">
                                    <label className="text-xs text-ink/60">{t('latenessSalary')}</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm"
                                        type="number"
                                        min={0}
                                        placeholder="0"
                                        value={salary}
                                        onChange={(e) => setSalary(e.target.value)}
                                    />
                                    <p className="mt-2 text-sm text-ink/70">
                                        {t('latenessEstimate')}: <span className="font-semibold">
                                            {estimatedDeduction ? estimatedDeduction.toLocaleString(dateLocale) : '0'}
                                        </span>
                                    </p>
                                    <p className="mt-2 text-sm text-ink/70">
                                        {t('latenessNetSalary')}: <span className="font-semibold">
                                            {netSalary ? netSalary.toLocaleString(dateLocale) : '0'}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-ink/50">{t('latenessPolicy')}</p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className={`min-w-[720px] w-full text-sm ${tableAlignClass}`}>
                                <thead className={tableAlignClass}>
                                    <tr className="border-b border-ink/10">
                                        <th className="py-2">{t('latenessDate')}</th>
                                        <th className="py-2">{t('latenessLateMinutes')}</th>
                                        <th className="py-2">{t('latenessStatus')}</th>
                                        <th className="py-2">{t('latenessAction')}</th>
                                    </tr>
                                </thead>
                                <tbody className={tableAlignClass}>
                                    {latenessLoading && (
                                        <tr>
                                            <td className="py-6 text-center text-ink/60" colSpan={4}>
                                                {t('latenessLoading')}
                                            </td>
                                        </tr>
                                    )}
                                    {!latenessLoading && latenessItems.length === 0 && (
                                        <tr>
                                            <td className="py-6 text-center text-ink/60" colSpan={4}>
                                                {t('latenessEmpty')}
                                            </td>
                                        </tr>
                                    )}
                                    {!latenessLoading && latenessItems.map((item) => (
                                        <tr key={item.id} className="border-b border-ink/5">
                                            <td className="py-2">{new Date(item.date).toLocaleDateString(dateLocale)}</td>
                                            <td className="py-2">{item.minutesLate}</td>
                                            <td className="py-2">
                                                {item.convertedToPermission ? t('latenessConverted') : t('latenessNotConverted')}
                                            </td>
                                            <td className="py-2">
                                                <button
                                                    className="btn-outline"
                                                    disabled={item.convertedToPermission}
                                                    onClick={() => convertLateness(item.id)}
                                                >
                                                    {item.convertedToPermission ? t('latenessConverted') : t('latenessConvert')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab !== 'lateness' && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-sm text-ink/60">{t('records', { count: total })}</p>
                        <div className="flex items-center gap-2">
                            <button className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                {t('prev')}
                            </button>
                            <p className="text-sm">{t('pageIndicator', { page, totalPages })}</p>
                            <button className="btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                                {t('next')}
                            </button>
                        </div>
                    </div>
                )}
            </section>

            <EmployeeHistoryModal
                open={historyOpen}
                user={user ? { id: user.id, fullName: user.fullName, fullNameAr: user.fullNameAr } : null}
                locale={locale}
                onClose={() => setHistoryOpen(false)}
            />
            <ConfirmDialog
                open={!!pendingDelete}
                message={tCommon('confirmDeleteItem')}
                confirmLabel={tCommon('confirm')}
                cancelLabel={tCommon('cancel')}
                confirmDisabled={deleteBusy}
                onConfirm={confirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </main>
    );
}
