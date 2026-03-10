'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import { enumLabels } from '@/lib/enum-labels';
import { getPublicApiUrl } from '@/lib/public-urls';
import PageLoader from './PageLoader';

type LeaveRequest = {
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    status: string;
    user: { fullName: string; employeeNumber: string };
};

type PermissionRequest = {
    id: string;
    permissionType: string;
    requestDate: string;
    hoursUsed: number;
    status: string;
    user: { fullName: string; employeeNumber: string };
};

type RequestRow = {
    id: string;
    requestType: 'leave' | 'permission';
    leaveType?: string;
    subtype: string;
    employeeName: string;
    employeeNumber: string;
    requestDate: string;
    status: string;
    details: string;
    pdfUrl: string;
};

export default function RequestsClient({ locale }: { locale: string }) {
    const t = useTranslations('requestsPage');
    const { user, ready } = useRequireAuth(locale);
    const apiBaseUrl = getPublicApiUrl();
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'leave' | 'absence' | 'mission' | 'permission'>('leave');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [filters, setFilters] = useState({
        status: '',
        search: '',
        from: '',
        to: '',
    });

    const dateLocale = useMemo(() => (locale === 'ar' ? 'ar-EG' : 'en-US'), [locale]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [leaveReqs, permissionReqs] = await Promise.all([
                api.get('/leaves'),
                api.get('/permissions'),
            ]);
            setLeaves(leaveReqs.data);
            setPermissions(permissionReqs.data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [fetchAll, ready]);

    const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';
    const canAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

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
            leaves.map((leave) => ({
                id: leave.id,
                requestType: 'leave',
                leaveType: leave.leaveType,
                subtype: enumLabels.leaveType(leave.leaveType, locale as 'en' | 'ar'),
                employeeName: leave.user.fullName,
                employeeNumber: leave.user.employeeNumber,
                requestDate: leave.startDate,
                status: leave.status,
                details: `${new Date(leave.startDate).toLocaleDateString(dateLocale)} - ${new Date(leave.endDate).toLocaleDateString(dateLocale)}`,
                pdfUrl: `${apiBaseUrl}/pdf/leave/${leave.id}`,
            })),
        [apiBaseUrl, dateLocale, leaves, locale],
    );

    const permissionRows = useMemo<RequestRow[]>(
        () =>
            permissions.map((perm) => ({
                id: perm.id,
                requestType: 'permission',
                subtype: enumLabels.permissionType(perm.permissionType, locale as 'en' | 'ar'),
                employeeName: perm.user.fullName,
                employeeNumber: perm.user.employeeNumber,
                requestDate: perm.requestDate,
                status: perm.status,
                details: `${perm.hoursUsed}h`,
                pdfUrl: `${apiBaseUrl}/pdf/permission/${perm.id}`,
            })),
        [apiBaseUrl, locale, permissions],
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
            leave: leaveOnlyRows,
            absence: absenceRows,
            mission: missionRows,
            permission: permissionRows,
        }),
        [absenceRows, leaveOnlyRows, missionRows, permissionRows],
    );

    const applyFilters = useCallback((rows: RequestRow[]) => {
        return rows.filter((row) => {
            const searchValue = `${row.employeeName} ${row.employeeNumber} ${row.subtype}`.toLowerCase();
            const statusOk = !filters.status || row.status === filters.status;
            const searchOk = !filters.search || searchValue.includes(filters.search.toLowerCase());
            const fromOk = !filters.from || new Date(row.requestDate) >= new Date(filters.from);
            const toOk = !filters.to || new Date(row.requestDate) <= new Date(`${filters.to}T23:59:59`);
            return statusOk && searchOk && fromOk && toOk;
        });
    }, [filters.from, filters.search, filters.status, filters.to]);

    const filteredRows = useMemo(() => applyFilters(rowsByTab[activeTab] || []), [activeTab, applyFilters, rowsByTab]);

    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pagedRows = useMemo(() => filteredRows.slice((page - 1) * limit, page * limit), [filteredRows, limit, page]);

    useEffect(() => {
        setPage(1);
    }, [activeTab, filters.from, filters.search, filters.status, filters.to, limit]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

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
        if (row.requestType === 'leave') return deleteLeave(row.id);
        return deletePermission(row.id);
    };

    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل الطلبات...' : 'Loading requests...'} />;
    }

    const tabs: Array<{ key: 'leave' | 'permission' | 'absence' | 'mission'; label: string; count: number }> = [
        { key: 'permission', label: t('tabPermission'), count: permissionRows.length },
        { key: 'leave', label: t('tabLeave'), count: leaveOnlyRows.length },
        { key: 'absence', label: t('tabAbsence'), count: absenceRows.length },
        { key: 'mission', label: t('tabMission'), count: missionRows.length },
    ];

    return (
        <main className="px-4 pb-12 sm:px-6">
            <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{t('title')}</h2>
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

                <div className="mt-4 flex flex-wrap gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            className={`btn-outline ${activeTab === tab.key ? 'bg-ink/10' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
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
                        <option value="PENDING">{enumLabels.status('PENDING', locale as 'en' | 'ar')}</option>
                        <option value="MANAGER_APPROVED">{enumLabels.status('MANAGER_APPROVED', locale as 'en' | 'ar')}</option>
                        <option value="HR_APPROVED">{enumLabels.status('HR_APPROVED', locale as 'en' | 'ar')}</option>
                        <option value="REJECTED">{enumLabels.status('REJECTED', locale as 'en' | 'ar')}</option>
                        <option value="CANCELLED">{enumLabels.status('CANCELLED', locale as 'en' | 'ar')}</option>
                    </select>
                    <input
                        type="date"
                        className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                        value={filters.from}
                        onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                    />
                    <input
                        type="date"
                        className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                        value={filters.to}
                        onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                    />
                    <button
                        className="btn-outline"
                        onClick={() => setFilters({ status: '', search: '', from: '', to: '' })}
                    >
                        {t('resetFilters')}
                    </button>
                </div>

                <div className="mt-4 overflow-x-auto">
                    <table className="min-w-[980px] w-full text-sm">
                        <thead>
                            <tr className="border-b border-ink/10 text-start">
                                <th className="py-2">{t('employee')}</th>
                                <th className="py-2">{t('requestType')}</th>
                                <th className="py-2">{t('details')}</th>
                                <th className="py-2">{t('date')}</th>
                                <th className="py-2">{t('status')}</th>
                                <th className="py-2">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
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
                                        <span className="pill bg-ink/10 text-ink">{enumLabels.status(row.status, locale as 'en' | 'ar')}</span>
                                    </td>
                                    <td className="py-2">
                                        <div className="flex flex-wrap gap-2">
                                            <a className="btn-outline" href={row.pdfUrl} target="_blank" rel="noreferrer noopener">
                                                {t('printPdf')}
                                            </a>
                                            {row.status === 'PENDING' && (
                                                <button className="btn-outline" onClick={() => onCancel(row)}>
                                                    {t('cancel')}
                                                </button>
                                            )}
                                            {canManage && row.status === 'PENDING' && (
                                                <>
                                                    <button className="btn-primary" onClick={() => onApprove(row)}>
                                                        {t('approve')}
                                                    </button>
                                                    <button className="btn-secondary" onClick={() => onReject(row)}>
                                                        {t('reject')}
                                                    </button>
                                                </>
                                            )}
                                            {canAdmin && (
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
            </section>
        </main>
    );
}
