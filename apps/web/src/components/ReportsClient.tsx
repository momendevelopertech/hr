'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api, { isAuthError } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import { enumLabels } from '@/lib/enum-labels';
import { getPublicApiUrl } from '@/lib/public-urls';
import { usePusherChannel } from '@/lib/use-pusher-channel';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import PageLoader from './PageLoader';
import DateRangeFilter from './DateRangeFilter';

type PaginatedResponse<T> = {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

type TabKey = 'leaves' | 'permissions' | 'missions' | 'absences' | 'summary' | 'pending';

type Department = { id: string; name: string; nameAr?: string | null };

type SummaryCard = {
    cycleStart?: string | null;
    cycleEnd?: string | null;
    totals?: {
        leaves?: number;
        permissions?: number;
        missions?: number;
        absences?: number;
    };
};

export default function ReportsClient({ locale }: { locale: string }) {
    const t = useTranslations('reports');
    const tEmployees = useTranslations('employees');
    const router = useRouter();
    const { user, ready } = useRequireAuth(locale);
    const apiBaseUrl = getPublicApiUrl();
    const dateLocale = useMemo(() => (locale === 'ar' ? 'ar-EG' : 'en-US'), [locale]);

    const role = user?.role;
    const isAdmin = role === 'HR_ADMIN' || role === 'SUPER_ADMIN';
    const canViewReports = isAdmin || role === 'MANAGER' || role === 'BRANCH_SECRETARY';

    const [tab, setTab] = useState<TabKey>('leaves');
    const [rows, setRows] = useState(10);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [summary, setSummary] = useState<SummaryCard | null>(null);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [filters, setFilters] = useState<any>({
        from: '',
        to: '',
        employee: '',
        status: '',
        departmentId: '',
        governorate: '',
        leaveType: '',
        permissionType: '',
    });

    const debouncedEmployee = useDebouncedValue(filters.employee, 400);
    const initialLoadRef = useRef(true);

    const refreshInFlight = useRef(false);

    const endpoint = useMemo(() => {
        if (tab === 'permissions') return '/reports/permissions';
        if (tab === 'summary') return '/reports/employee-summary';
        if (tab === 'pending') return '/reports/pending';
        return '/reports/leaves';
    }, [tab]);

    const params = useMemo(() => {
        const effectiveLeaveType =
            tab === 'missions'
                ? 'MISSION'
                : tab === 'absences'
                    ? 'ABSENCE_WITH_PERMISSION'
                    : filters.leaveType || '';

        return {
            page,
            limit: rows,
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
            ...(debouncedEmployee ? { employee: debouncedEmployee } : {}),
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
            ...(filters.governorate ? { governorate: filters.governorate } : {}),
            ...(filters.permissionType && tab === 'permissions' ? { permissionType: filters.permissionType } : {}),
            ...(effectiveLeaveType ? { leaveType: effectiveLeaveType } : {}),
        };
    }, [debouncedEmployee, filters.departmentId, filters.from, filters.governorate, filters.leaveType, filters.permissionType, filters.status, filters.to, page, rows, tab]);

    const backgroundConfig = useMemo(() => ({ headers: { 'x-skip-activity': '1' } }), []);

    const fetchSummary = useCallback(async (skipActivity = false) => {
        if (!canViewReports) return;
        try {
            const res = await api.get('/reports/summary', skipActivity ? backgroundConfig : undefined);
            setSummary(res.data);
        } catch (error) {
            if (isAuthError(error)) return;
        }
    }, [backgroundConfig, canViewReports]);

    const refreshData = useCallback(async (skipActivity = false) => {
        if (refreshInFlight.current) return;
        refreshInFlight.current = true;
        try {
            const res = await api.get<PaginatedResponse<any>>(
                endpoint,
                skipActivity
                    ? { ...backgroundConfig, params }
                    : { params },
            );
            setData(res.data.items || []);
            setTotal(res.data.total || 0);
            setTotalPages(res.data.totalPages || 1);
        } catch (error) {
            if (isAuthError(error)) return;
        } finally {
            refreshInFlight.current = false;
        }
    }, [backgroundConfig, endpoint, params]);

    const fetchData = useCallback(async () => {
        const isInitial = initialLoadRef.current;
        if (isInitial) setLoading(true);
        try {
            await Promise.all([refreshData(), fetchSummary()]);
        } finally {
            if (isInitial) {
                setLoading(false);
                initialLoadRef.current = false;
            }
        }
    }, [fetchSummary, refreshData]);

    const fetchDepartments = useCallback(async () => {
        if (!isAdmin) return;
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
    }, [isAdmin]);

    useEffect(() => {
        if (!ready) return;
        if (!canViewReports) {
            router.replace(`/${locale}`);
            return;
        }
        fetchData();
    }, [ready, canViewReports, locale, router, fetchData]);

    useEffect(() => {
        if (!ready || !isAdmin) return;
        fetchDepartments();
    }, [fetchDepartments, isAdmin, ready]);

    const notificationHandlers = useMemo(
        () => ({
            notification: () => {
                refreshData(true);
                fetchSummary(true);
            },
        }),
        [fetchSummary, refreshData],
    );

    usePusherChannel(user ? `user-${user.id}` : null, notificationHandlers);

    useEffect(() => {
        if (!ready || !canViewReports) return;
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            refreshData(true);
            fetchSummary(true);
        }, 30000);
        return () => clearInterval(interval);
    }, [canViewReports, fetchSummary, ready, refreshData]);

    useEffect(() => {
        setPage(1);
    }, [tab, debouncedEmployee, filters.departmentId, filters.from, filters.governorate, filters.leaveType, filters.permissionType, filters.status, filters.to, rows]);

    const tableAlignClass = locale === 'ar' ? 'text-right' : 'text-left';
    const showEmergency = useMemo(
        () => data.some((item) => (item?.counts?.emergency ?? 0) > 0),
        [data],
    );
    const formatDateOnlyFromIso = useCallback((value?: string | null) => {
        if (!value) return '';
        const datePart = value.split('T')[0];
        const [year, month, day] = datePart.split('-').map((part) => Number(part));
        if (!year || !month || !day) return new Date(value).toLocaleDateString(dateLocale);
        return new Date(year, month - 1, day).toLocaleDateString(dateLocale);
    }, [dateLocale]);

    const summaryRange = useMemo(() => {
        if (!summary?.cycleStart || !summary?.cycleEnd) return '';
        return `${formatDateOnlyFromIso(summary.cycleStart)} - ${formatDateOnlyFromIso(summary.cycleEnd)}`;
    }, [formatDateOnlyFromIso, summary?.cycleEnd, summary?.cycleStart]);

    const tabs: Array<{ key: TabKey; label: string }> = [
        { key: 'leaves', label: t('leaveTitle') },
        { key: 'permissions', label: t('permissionTitle') },
        { key: 'missions', label: t('missionTitle') },
        { key: 'absences', label: t('absenceTitle') },
        { key: 'summary', label: t('summaryTitle') },
        { key: 'pending', label: t('pendingTitle') },
    ];

    const showStatusFilter = tab !== 'pending';
    const showLeaveTypeFilter = tab === 'leaves';
    const showPermissionTypeFilter = tab === 'permissions';

    const exportEnabled = tab === 'leaves' || tab === 'permissions' || tab === 'missions' || tab === 'absences';
    const exportType = tab === 'permissions' ? 'permissions' : 'leaves';
    const exportParams = useMemo(() => {
        const { page: _page, limit: _limit, ...rest } = params || {};
        return new URLSearchParams(rest as Record<string, string>).toString();
    }, [params]);
    const exportUrl = exportEnabled
        ? `${apiBaseUrl}/reports/${exportType}/excel${exportParams ? `?${exportParams}` : ''}`
        : '';

    const stageLabel = (stage?: string) => {
        if (stage === 'WAITING_SECRETARY') return t('stageSecretary');
        if (stage === 'WAITING_MANAGER') return t('stageManager');
        if (stage === 'WAITING_HR') return t('stageHr');
        return t('stageUnknown');
    };

    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل التقارير...' : 'Loading reports...'} />;
    }
    if (!canViewReports) return null;

    return (
        <main className="px-4 pb-12 sm:px-6 space-y-6">
            {summary && (
                <section className="card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">{t('statsTitle')}</h2>
                        {summaryRange && <p className="text-sm text-ink/60">{t('summaryCycleLabel', { range: summaryRange })}</p>}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
                            <p className="text-sm text-ink/60">{t('statsLeaves')}</p>
                            <p className="text-lg font-semibold">{summary.totals?.leaves ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
                            <p className="text-sm text-ink/60">{t('statsPermissions')}</p>
                            <p className="text-lg font-semibold">{summary.totals?.permissions ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
                            <p className="text-sm text-ink/60">{t('statsMissions')}</p>
                            <p className="text-lg font-semibold">{summary.totals?.missions ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
                            <p className="text-sm text-ink/60">{t('statsAbsences')}</p>
                            <p className="text-lg font-semibold">{summary.totals?.absences ?? 0}</p>
                        </div>
                    </div>
                </section>
            )}

            <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((item) => (
                            <button
                                key={item.key}
                                className={`btn-outline ${tab === item.key ? 'bg-ink/10' : ''}`}
                                onClick={() => {
                                    setTab(item.key);
                                    setPage(1);
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    {exportEnabled && (
                        <a
                            className="btn-outline"
                            href={exportUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {t('exportExcel')}
                        </a>
                    )}
                </div>

                <div className={`mt-4 grid gap-2 ${isAdmin ? 'md:grid-cols-3 xl:grid-cols-7' : 'md:grid-cols-3 xl:grid-cols-5'}`}>
                    <DateRangeFilter
                        locale={locale}
                        from={filters.from}
                        to={filters.to}
                        onChange={({ from, to }) => {
                            setPage(1);
                            setFilters((p: any) => ({ ...p, from, to }));
                        }}
                    />
                    <input
                        className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                        placeholder={t('employeeSearchPlaceholder')}
                        value={filters.employee}
                        onChange={(e) => setFilters((p: any) => ({ ...p, employee: e.target.value }))}
                    />
                    {showLeaveTypeFilter && (
                        <select
                            className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={filters.leaveType}
                            onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, leaveType: e.target.value })); }}
                        >
                            <option value="">{t('leaveTypeFilter')}</option>
                            <option value="ANNUAL">{enumLabels.leaveType('ANNUAL', locale as 'en' | 'ar')}</option>
                            <option value="CASUAL">{enumLabels.leaveType('CASUAL', locale as 'en' | 'ar')}</option>
                            <option value="EMERGENCY">{enumLabels.leaveType('EMERGENCY', locale as 'en' | 'ar')}</option>
                        </select>
                    )}
                    {showPermissionTypeFilter && (
                        <select
                            className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={filters.permissionType}
                            onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, permissionType: e.target.value })); }}
                        >
                            <option value="">{t('permissionTypeFilter')}</option>
                            <option value="PERSONAL">{enumLabels.permissionType('PERSONAL', locale as 'en' | 'ar')}</option>
                            <option value="LATE_ARRIVAL">{enumLabels.permissionType('LATE_ARRIVAL', locale as 'en' | 'ar')}</option>
                            <option value="EARLY_LEAVE">{enumLabels.permissionType('EARLY_LEAVE', locale as 'en' | 'ar')}</option>
                        </select>
                    )}
                    {isAdmin && (
                        <select
                            className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={filters.governorate}
                            onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, governorate: e.target.value })); }}
                        >
                            <option value="">{t('governorateFilter')}</option>
                            <option value="CAIRO">{tEmployees('govCairo')}</option>
                            <option value="ALEXANDRIA">{tEmployees('govAlexandria')}</option>
                        </select>
                    )}
                    {isAdmin && (
                        <select
                            className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={filters.departmentId}
                            onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, departmentId: e.target.value })); }}
                        >
                            <option value="">{t('departmentFilter')}</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {locale === 'ar' ? dept.nameAr || dept.name : dept.name}
                                </option>
                            ))}
                        </select>
                    )}
                    {showStatusFilter && (
                        <select
                            className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={filters.status}
                            onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, status: e.target.value })); }}
                        >
                            <option value="">{t('status')}</option>
                            <option value="PENDING">{enumLabels.status('PENDING', locale as 'en' | 'ar')}</option>
                            <option value="MANAGER_APPROVED">{enumLabels.status('MANAGER_APPROVED', locale as 'en' | 'ar')}</option>
                            <option value="HR_APPROVED">{enumLabels.status('HR_APPROVED', locale as 'en' | 'ar')}</option>
                            <option value="REJECTED">{enumLabels.status('REJECTED', locale as 'en' | 'ar')}</option>
                            <option value="CANCELLED">{enumLabels.status('CANCELLED', locale as 'en' | 'ar')}</option>
                        </select>
                    )}
                    <label className="text-sm">
                        {t('rowsPerPage')}
                        <select
                            className="ms-2 rounded-lg border border-ink/20 px-2 py-1"
                            value={rows}
                            onChange={(e) => { setPage(1); setRows(parseInt(e.target.value, 10)); }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </label>
                </div>

                <div className="mt-4 overflow-x-auto">
                    {tab === 'summary' ? (
                        <table className={`min-w-[920px] w-full text-sm ${tableAlignClass}`}>
                            <thead className={tableAlignClass}>
                                <tr className="border-b border-ink/10">
                                    <th className="py-2">{t('employee')}</th>
                                    <th className="py-2">{t('summaryAnnual')}</th>
                                    <th className="py-2">{t('summaryCasual')}</th>
                                    <th className="py-2">{t('summaryPermissions')}</th>
                                    <th className="py-2">{t('summaryMissions')}</th>
                                    <th className="py-2">{t('summaryAbsences')}</th>
                                    {showEmergency && <th className="py-2">{t('summaryEmergency')}</th>}
                                </tr>
                            </thead>
                            <tbody className={tableAlignClass}>
                                {data.map((item) => (
                                    <tr key={item.id} className="border-b border-ink/5">
                                        <td className="py-2">
                                            <p className="font-medium">{locale === 'ar' ? item.fullNameAr || item.fullName : item.fullName}</p>
                                            <p className="text-xs text-ink/60">#{item.employeeNumber}</p>
                                        </td>
                                        <td className="py-2">{item.counts?.annual ?? 0}</td>
                                        <td className="py-2">{item.counts?.casual ?? 0}</td>
                                        <td className="py-2">{item.counts?.permissions ?? 0}</td>
                                        <td className="py-2">{item.counts?.mission ?? 0}</td>
                                        <td className="py-2">{item.counts?.absence ?? 0}</td>
                                        {showEmergency && <td className="py-2">{item.counts?.emergency ?? 0}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : tab === 'pending' ? (
                        <table className={`min-w-[920px] w-full text-sm ${tableAlignClass}`}>
                            <thead className={tableAlignClass}>
                                <tr className="border-b border-ink/10">
                                    <th className="py-2">{t('employee')}</th>
                                    <th className="py-2">{t('type')}</th>
                                    <th className="py-2">{t('stage')}</th>
                                    <th className="py-2">{t('date')}</th>
                                    <th className="py-2">{t('department')}</th>
                                </tr>
                            </thead>
                            <tbody className={tableAlignClass}>
                                {data.map((item) => {
                                    const employee = locale === 'ar'
                                        ? item.user?.fullNameAr || item.user?.fullName || '-'
                                        : item.user?.fullName || '-';
                                    const type = item.leaveType || item.permissionType || '-';
                                    const typeLabel = item.requestType === 'leave'
                                        ? enumLabels.leaveType(type, locale as 'en' | 'ar')
                                        : enumLabels.permissionType(type, locale as 'en' | 'ar');
                                    const dateValue = item.requestDate || item.createdAt || '-';
                                    const dept = locale === 'ar'
                                        ? item.user?.department?.nameAr || item.user?.department?.name || item.department?.nameAr || item.department?.name || '-'
                                        : item.user?.department?.name || item.department?.name || '-';
                                    return (
                                        <tr key={item.id} className="border-b border-ink/5">
                                            <td className="py-2">
                                                <p className="font-medium">{employee}</p>
                                                <p className="text-xs text-ink/60">#{item.user?.employeeNumber}</p>
                                            </td>
                                            <td className="py-2">{typeLabel}</td>
                                            <td className="py-2">{stageLabel(item.stage)}</td>
                                            <td className="py-2">{dateValue !== '-' ? new Date(dateValue).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : '-'}</td>
                                            <td className="py-2">{dept}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <table className={`min-w-[920px] w-full text-sm ${tableAlignClass}`}>
                            <thead className={tableAlignClass}>
                                <tr className="border-b border-ink/10">
                                    <th className="py-2">{t('employee')}</th>
                                    <th className="py-2">{t('type')}</th>
                                    <th className="py-2">{t('status')}</th>
                                    <th className="py-2">{t('date')}</th>
                                    <th className="py-2">{t('department')}</th>
                                </tr>
                            </thead>
                            <tbody className={tableAlignClass}>
                                {data.map((item) => {
                                    const employee = locale === 'ar'
                                        ? item.user?.fullNameAr || item.user?.fullName || item.fullName || '-'
                                        : item.user?.fullName || item.fullName || '-';
                                    const type = item.leaveType
                                        || item.permissionType
                                        || item.role
                                        || '-';
                                    const status = item.status || (item.isActive ? 'ACTIVE' : 'INACTIVE');
                                    const statusLabel = enumLabels.status(status, locale as 'en' | 'ar', {
                                        requestType: tab === 'permissions' ? 'permission' : 'leave',
                                        approvedByMgrId: item.approvedByMgrId ?? null,
                                    });
                                    const typeLabel = item.leaveType
                                        ? enumLabels.leaveType(type, locale as 'en' | 'ar')
                                        : item.permissionType
                                            ? enumLabels.permissionType(type, locale as 'en' | 'ar')
                                            : type;
                                    const date = item.startDate || item.requestDate || item.createdAt || '-';
                                    const dept = locale === 'ar'
                                        ? item.user?.department?.nameAr || item.user?.department?.name || item.department?.nameAr || item.department?.name || '-'
                                        : item.user?.department?.name || item.department?.name || '-';
                                    return (
                                        <tr key={item.id} className="border-b border-ink/5">
                                            <td className="py-2">{employee}</td>
                                            <td className="py-2">{typeLabel}</td>
                                            <td className="py-2">{statusLabel}</td>
                                            <td className="py-2">{date !== '-' ? new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : '-'}</td>
                                            <td className="py-2">{dept}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-ink/60">{t('records', { count: total })}</p>
                    <div className="flex items-center gap-2">
                        <button className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t('prev')}</button>
                        <p className="text-sm">{t('page', { page, totalPages })}</p>
                        <button className="btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{t('next')}</button>
                    </div>
                </div>
            </section>
        </main>
    );
}
