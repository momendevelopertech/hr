'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import api, { isAuthError } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import { usePusherChannel } from '@/lib/use-pusher-channel';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import PageLoader from './PageLoader';
import DateRangeFilter from './DateRangeFilter';
import AsyncActionButton from './AsyncActionButton';

type NotificationItem = {
    id: string;
    title: string;
    titleAr?: string | null;
    body?: string | null;
    bodyAr?: string | null;
    type: string;
    createdAt: string;
    isRead: boolean;
};

type NotificationsResponse = {
    items: NotificationItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

const notificationTypes = ['LEAVE_REQUEST', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'PERMISSION_REQUEST', 'PERMISSION_APPROVED', 'PERMISSION_REJECTED', 'FORM_SUBMISSION', 'FORM_APPROVED', 'FORM_REJECTED', 'ANNOUNCEMENT'] as const;

export default function NotificationsClient({ locale }: { locale: string }) {
    const t = useTranslations('notifications');
    const { user, ready } = useRequireAuth(locale);
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState<any>({ type: '', status: '', search: '', from: '', to: '' });
    const debouncedSearch = useDebouncedValue(filters.search, 400);
    const initialLoadRef = useRef(true);
    const typeLabels = useMemo(() => {
        const map: Record<string, string> = {};
        notificationTypes.forEach((type) => {
            map[type] = t(`types.${type}`);
        });
        return map;
    }, [t]);
    const hasArabic = (value?: string | null) => !!value && /[\u0600-\u06FF]/.test(value);
    const hasMojibake = (value?: string | null) => !!value && /\?{2,}/.test(value);
    const getArabicTitleFallback = (title: string) => {
        if (!title) return '';
        if (title.startsWith('Form Approved: ')) {
            return `تمت الموافقة على النموذج: ${title.replace('Form Approved: ', '')}`;
        }
        if (title.startsWith('Form Rejected: ')) {
            return `تم رفض النموذج: ${title.replace('Form Rejected: ', '')}`;
        }
        if (title.startsWith('New Form: ')) {
            return `نموذج جديد: ${title.replace('New Form: ', '')}`;
        }
        const map: Record<string, string> = {
            'New Leave Request': 'طلب إجازة جديد',
            'Leave Request Needs Approval': 'طلب إجازة يحتاج موافقتك',
            'Leave Pending HR Approval': 'طلب إجازة بانتظار موافقة الموارد البشرية',
            'Leave Request Submitted': 'تم تقديم طلب إجازة',
            'Leave Request Verified': 'تم التحقق من طلب الإجازة',
            'Leave Approved by Manager': 'موافقة المدير على طلب الإجازة',
            'Leave Request Approved': 'تمت الموافقة على طلب الإجازة',
            'Leave Request Rejected': 'تم رفض طلب الإجازة',
            'New Permission Request': 'طلب إذن جديد',
            'Permission Request Needs Approval': 'طلب إذن يحتاج موافقتك',
            'Permission Pending HR Approval': 'طلب إذن بانتظار موافقة الموارد البشرية',
            'Permission Request Submitted': 'تم تقديم طلب إذن',
            'Permission Request Verified': 'تم التحقق من طلب الإذن',
            'Permission Approved by Manager': 'موافقة المدير على طلب الإذن',
            'Permission Approved': 'تمت الموافقة على طلب الإذن',
            'Permission Rejected': 'تم رفض طلب الإذن',
            'Payroll Released': 'تم صرف الرواتب',
        };
        return map[title] || '';
    };
    const getDisplayTitle = (item: NotificationItem) => {
        if (locale !== 'ar') return item.title || item.titleAr || '';
        if (hasArabic(item.titleAr) && !hasMojibake(item.titleAr)) return item.titleAr || '';
        if (hasArabic(item.title)) return item.title || '';
        const fallback = getArabicTitleFallback(item.title || '');
        if (fallback) return fallback;
        return typeLabels[item.type] || item.titleAr || item.title || '';
    };

    const params = useMemo(() => ({
        page,
        limit,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
    }), [debouncedSearch, filters.from, filters.status, filters.to, filters.type, limit, page]);

    const refreshInFlight = useRef(false);

    const backgroundConfig = useMemo(() => ({ headers: { 'x-skip-activity': '1' } }), []);

    const refreshAll = useCallback(async (skipActivity = false) => {
        if (refreshInFlight.current) return;
        refreshInFlight.current = true;
        try {
            const res = await api.get<NotificationsResponse>(
                '/notifications',
                skipActivity
                    ? { ...backgroundConfig, params }
                    : { params },
            );
            setItems(res.data.items || []);
            setTotal(res.data.total || 0);
            setTotalPages(res.data.totalPages || 1);
        } catch (error) {
            if (isAuthError(error)) return;
        } finally {
            refreshInFlight.current = false;
        }
    }, [backgroundConfig, params]);

    const fetchAll = useCallback(async () => {
        const isInitial = initialLoadRef.current;
        if (isInitial) setLoading(true);
        try {
            await refreshAll();
        } finally {
            if (isInitial) {
                setLoading(false);
                initialLoadRef.current = false;
            }
        }
    }, [refreshAll]);

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [ready, fetchAll]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

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

    const [markAllPending, setMarkAllPending] = useState(false);

    const markAll = async () => {
        if (markAllPending) return;
        setMarkAllPending(true);
        try {
            await api.patch('/notifications/read-all');
            await fetchAll();
        } finally {
            setMarkAllPending(false);
        }
    };

    const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US';
    const tableAlignClass = locale === 'ar' ? 'text-right' : 'text-left';

    if (!ready || loading) {
        return <PageLoader text={t('loading')} />;
    }

    return (
        <main className="px-4 pb-12 sm:px-6">
            <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{t('title')}</h2>
                    <AsyncActionButton
                        className="btn-outline"
                        onClick={markAll}
                        externalPending={markAllPending}
                        pendingLabel={t('markAllRead')}
                    >
                        {t('markAllRead')}
                    </AsyncActionButton>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                    <input
                        className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                        placeholder={t('search')}
                        value={filters.search}
                        onChange={(e) => setFilters((p: any) => ({ ...p, search: e.target.value }))}
                    />
                    <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" value={filters.type} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, type: e.target.value })); }}>
                        <option value="">{t('type')}</option>
                        {notificationTypes.map((type) => (
                            <option key={type} value={type}>{typeLabels[type]}</option>
                        ))}
                    </select>
                    <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" value={filters.status} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, status: e.target.value })); }}>
                        <option value="">{t('status')}</option>
                        <option value="read">{t('read')}</option>
                        <option value="unread">{t('unread')}</option>
                    </select>
                    <DateRangeFilter
                        locale={locale}
                        from={filters.from}
                        to={filters.to}
                        onChange={({ from, to }) => {
                            setPage(1);
                            setFilters((p: any) => ({ ...p, from, to }));
                        }}
                    />
                    <label className="text-sm">
                        {t('rowsPerPage')}
                        <select className="ms-2 rounded-lg border border-ink/20 px-2 py-1" value={limit} onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value, 10)); }}>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </label>
                </div>

                <div className="mt-4 overflow-x-auto">
                    <table className={`min-w-[760px] w-full text-sm ${tableAlignClass}`}>
                        <thead className={tableAlignClass}>
                            <tr className="border-b border-ink/10">
                                <th className="py-2">{t('titleColumn')}</th>
                                <th className="py-2">{t('type')}</th>
                                <th className="py-2">{t('date')}</th>
                                <th className="py-2">{t('status')}</th>
                            </tr>
                        </thead>
                        <tbody className={tableAlignClass}>
                            {items.map((item) => (
                                <tr key={item.id} className="border-b border-ink/5">
                                    <td className="py-2">{getDisplayTitle(item)}</td>
                                    <td className="py-2">{typeLabels[item.type] || item.type}</td>
                                    <td className="py-2">{new Date(item.createdAt).toLocaleString(dateLocale)}</td>
                                    <td className="py-2">{item.isRead ? t('read') : t('unread')}</td>
                                </tr>
                            ))}
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
