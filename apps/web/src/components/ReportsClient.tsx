'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import { enumLabels } from '@/lib/enum-labels';
import { getPublicApiUrl } from '@/lib/public-urls';
import PageLoader from './PageLoader';

type PaginatedResponse<T> = {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

type TabKey = 'leaves' | 'permissions' | 'forms' | 'employees';

export default function ReportsClient({ locale }: { locale: string }) {
    const t = useTranslations('reports');
    const router = useRouter();
    const { user, ready } = useRequireAuth(locale);
    const apiBaseUrl = getPublicApiUrl();
    const [tab, setTab] = useState<TabKey>('leaves');
    const [rows, setRows] = useState(10);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [filters, setFilters] = useState<any>({ from: '', to: '', employee: '', status: '', reportType: '' });

    const canAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    const endpoint = useMemo(() => {
        if (tab === 'leaves') return '/reports/leaves';
        if (tab === 'permissions') return '/reports/permissions';
        if (tab === 'forms') return '/reports/forms';
        return '/reports/employees';
    }, [tab]);

    const params = useMemo(() => ({
        page,
        limit: rows,
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(filters.employee ? { employee: filters.employee } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.reportType ? { reportType: filters.reportType } : {}),
    }), [filters.employee, filters.from, filters.reportType, filters.status, filters.to, page, rows]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<PaginatedResponse<any>>(endpoint, { params });
            setData(res.data.items || []);
            setTotal(res.data.total || 0);
            setTotalPages(res.data.totalPages || 1);
        } finally {
            setLoading(false);
        }
    }, [endpoint, params]);

    useEffect(() => {
        if (!ready) return;
        if (!canAdmin) {
            router.replace(`/${locale}`);
            return;
        }
        fetchData();
    }, [ready, canAdmin, locale, router, fetchData]);

    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل التقارير...' : 'Loading reports...'} />;
    }
    if (!canAdmin) return null;

    return (
        <main className="px-4 pb-12 sm:px-6 space-y-6">
            <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                        <button className={`btn-outline ${tab === 'leaves' ? 'bg-ink/10' : ''}`} onClick={() => { setTab('leaves'); setPage(1); }}>{t('leaveTitle')}</button>
                        <button className={`btn-outline ${tab === 'permissions' ? 'bg-ink/10' : ''}`} onClick={() => { setTab('permissions'); setPage(1); }}>{t('permissionTitle')}</button>
                        <button className={`btn-outline ${tab === 'forms' ? 'bg-ink/10' : ''}`} onClick={() => { setTab('forms'); setPage(1); }}>{t('formsTitle')}</button>
                        <button className={`btn-outline ${tab === 'employees' ? 'bg-ink/10' : ''}`} onClick={() => { setTab('employees'); setPage(1); }}>{t('employeeTitle')}</button>
                    </div>
                    {(tab === 'leaves' || tab === 'permissions') && (
                        <a
                            className="btn-outline"
                            href={`${apiBaseUrl}/reports/${tab}/excel`}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {t('exportExcel')}
                        </a>
                    )}
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                    <input type="date" className="rounded-xl border border-ink/20 bg-white px-3 py-2" value={filters.from} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, from: e.target.value })); }} />
                    <input type="date" className="rounded-xl border border-ink/20 bg-white px-3 py-2" value={filters.to} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, to: e.target.value })); }} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder={t('employeeFilter')} value={filters.employee} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, employee: e.target.value })); }} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder={t('reportTypeFilter')} value={filters.reportType} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, reportType: e.target.value })); }} />
                    <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" value={filters.status} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, status: e.target.value })); }}>
                        <option value="">{t('status')}</option>
                        <option value="PENDING">{enumLabels.status('PENDING', locale as 'en' | 'ar')}</option>
                        <option value="MANAGER_APPROVED">{enumLabels.status('MANAGER_APPROVED', locale as 'en' | 'ar')}</option>
                        <option value="HR_APPROVED">{enumLabels.status('HR_APPROVED', locale as 'en' | 'ar')}</option>
                        <option value="REJECTED">{enumLabels.status('REJECTED', locale as 'en' | 'ar')}</option>
                    </select>
                    <label className="text-sm">
                        {t('rowsPerPage')}
                        <select className="ms-2 rounded-lg border border-ink/20 px-2 py-1" value={rows} onChange={(e) => { setPage(1); setRows(parseInt(e.target.value, 10)); }}>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </label>
                </div>

                <div className="mt-4 overflow-x-auto">
                    <table className="min-w-[920px] w-full text-sm">
                        <thead>
                            <tr className="border-b border-ink/10 text-start">
                                <th className="py-2">{t('employee')}</th>
                                <th className="py-2">{t('type')}</th>
                                <th className="py-2">{t('status')}</th>
                                <th className="py-2">{t('date')}</th>
                                <th className="py-2">{t('department')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item) => {
                                const employee = item.user?.fullName || item.fullName || '-';
                                const type = item.leaveType
                                    || item.permissionType
                                    || (tab === 'forms' ? (locale === 'ar' ? item.form?.nameAr || item.form?.name : item.form?.name) : null)
                                    || item.form?.name
                                    || item.role
                                    || '-';
                                const status = item.status || (item.isActive ? 'ACTIVE' : 'INACTIVE');
                                const statusLabel = tab === 'employees'
                                    ? (status === 'ACTIVE' ? t('active') : t('inactive'))
                                    : enumLabels.status(status, locale as 'en' | 'ar');
                                const typeLabel = tab === 'leaves'
                                    ? enumLabels.leaveType(type, locale as 'en' | 'ar')
                                    : tab === 'permissions'
                                        ? enumLabels.permissionType(type, locale as 'en' | 'ar')
                                        : tab === 'employees'
                                            ? enumLabels.role(type, locale as 'en' | 'ar')
                                            : type;
                                const date = item.createdAt || item.requestDate || '-';
                                const dept = item.user?.department?.name || item.department?.name || '-';
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
