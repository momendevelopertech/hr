'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';

type HistoryUser = {
    id: string;
    fullName: string;
    fullNameAr?: string | null;
};

type Props = {
    open: boolean;
    user: HistoryUser | null;
    locale: string;
    onClose: () => void;
};

export default function EmployeeHistoryModal({ open, user, locale, onClose }: Props) {
    const t = useTranslations('employees');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!open || !user) return;
        let active = true;
        setLoading(true);
        setData(null);
        setExpanded({});
        api.get(`/users/${user.id}/history`, { params: { includeDetails: 1 } })
            .then((res) => {
                if (!active) return;
                setData(res.data);
            })
            .finally(() => {
                if (!active) return;
                setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [open, user?.id]);

    const formatCycleLabel = (value?: string) => {
        if (!value) return '';
        const date = new Date(value);
        return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
    };

    const formatDateOnly = (value?: string) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US');
    };

    const historyCycles = useMemo(
        () => (data?.cycles || []).filter((cycle: any) => cycle.key !== data?.currentCycle?.key),
        [data],
    );
    const hasCurrentData = useMemo(() => {
        const totals = data?.currentCycle?.totals;
        if (!totals) return false;
        return Object.values(totals).some((value) => Number(value) > 0);
    }, [data?.currentCycle?.totals]);

    const toggleCycle = (key: string) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    if (!open || !user) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="card w-full max-w-4xl p-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                        {t('historyTitle')} - {locale === 'ar' ? user.fullNameAr || user.fullName : user.fullName}
                    </h3>
                    <button className="btn-outline" onClick={onClose}>×</button>
                </div>
                {loading ? (
                    <p className="mt-4 text-sm text-ink/60">{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
                ) : (
                    <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm text-ink/60">{t('historyCurrentCycle')}</p>
                                <p className="text-sm font-semibold">{formatCycleLabel(data?.currentCycle?.start)}</p>
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-3">
                                {[
                                    { key: 'annual', label: t('historyAnnual') },
                                    { key: 'casual', label: t('historyCasual') },
                                    { key: 'permissions', label: t('historyPermissions') },
                                    { key: 'mission', label: t('historyMission') },
                                    { key: 'absence', label: t('historyAbsence') },
                                    ...(data?.currentCycle?.totals?.emergency > 0 ? [{ key: 'emergency', label: t('historyEmergency') }] : []),
                                    ...(data?.currentCycle?.totals?.other > 0 ? [{ key: 'other', label: t('historyOther') }] : []),
                                ].map((item) => (
                                    <div key={item.key} className="rounded-lg border border-ink/10 bg-white p-3">
                                        <p className="text-xs text-ink/60">{item.label}</p>
                                        <p className="text-lg font-semibold">{data?.currentCycle?.totals?.[item.key] ?? 0}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {!historyCycles.length && !hasCurrentData && (
                            <p className="text-sm text-ink/60">{t('historyEmpty')}</p>
                        )}

                        {historyCycles.map((cycle: any) => {
                            const isExpanded = !!expanded[cycle.key];
                            const detailGroups = [
                                { key: 'annual', label: t('historyAnnual') },
                                { key: 'casual', label: t('historyCasual') },
                                { key: 'mission', label: t('historyMission') },
                                { key: 'absence', label: t('historyAbsence') },
                                ...(cycle?.details?.emergency?.length ? [{ key: 'emergency', label: t('historyEmergency') }] : []),
                                ...(cycle?.details?.other?.length ? [{ key: 'other', label: t('historyOther') }] : []),
                            ].filter((group) => (cycle?.details?.[group.key] || []).length > 0);
                            const permissionDetails = cycle?.details?.permissions || [];
                            const hasDetails = detailGroups.length > 0 || permissionDetails.length > 0;
                            return (
                                <div key={cycle.key} className="rounded-xl border border-ink/10 bg-white/70 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm text-ink/60">{t('historyCycle')}</p>
                                            <p className="text-base font-semibold">{formatCycleLabel(cycle.start)}</p>
                                        </div>
                                        <button className="btn-outline text-xs" onClick={() => toggleCycle(cycle.key)}>
                                            {isExpanded ? t('historyHideDetails') : t('historyShowDetails')}
                                        </button>
                                    </div>
                                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                                        {[
                                            { key: 'annual', label: t('historyAnnual') },
                                            { key: 'casual', label: t('historyCasual') },
                                            { key: 'permissions', label: t('historyPermissions') },
                                            { key: 'mission', label: t('historyMission') },
                                            { key: 'absence', label: t('historyAbsence') },
                                            ...(cycle?.totals?.emergency > 0 ? [{ key: 'emergency', label: t('historyEmergency') }] : []),
                                            ...(cycle?.totals?.other > 0 ? [{ key: 'other', label: t('historyOther') }] : []),
                                        ].map((item) => (
                                            <div key={item.key} className="rounded-lg border border-ink/10 bg-white p-3">
                                                <p className="text-xs text-ink/60">{item.label}</p>
                                                <p className="text-lg font-semibold">{cycle?.totals?.[item.key] ?? 0}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {isExpanded && (
                                        <div className="mt-4 space-y-3">
                                            {detailGroups.map((group) => (
                                                <div key={group.key}>
                                                    <p className="text-sm font-semibold">{group.label}</p>
                                                    <div className="mt-2 space-y-2">
                                                        {(cycle?.details?.[group.key] || []).map((item: any) => (
                                                            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm">
                                                                <span>{formatDateOnly(item.startDate)}{item.endDate ? ` - ${formatDateOnly(item.endDate)}` : ''}</span>
                                                                <span className="text-xs text-ink/60">#{item.id}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {permissionDetails.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-semibold">{t('historyPermissions')}</p>
                                                    <div className="mt-2 space-y-2">
                                                        {permissionDetails.map((item: any) => (
                                                            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm">
                                                                <span>{formatDateOnly(item.requestDate)} - {item.hoursUsed}h</span>
                                                                <span className="text-xs text-ink/60">#{item.id}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {!hasDetails && (
                                                <p className="text-xs text-ink/50">{t('historyNoDetails')}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
