'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import PageLoader from './PageLoader';

type WorkScheduleSettings = {
    id: string;
    activeMode: 'NORMAL' | 'RAMADAN';
    weekdayStart: string;
    weekdayEnd: string;
    saturdayStart: string;
    saturdayEnd: string;
    ramadanStart: string;
    ramadanEnd: string;
    ramadanStartDate: string | null;
    ramadanEndDate: string | null;
    pwaInstallEnabled: boolean;
};

const DEFAULT_SETTINGS: WorkScheduleSettings = {
    id: '',
    activeMode: 'NORMAL',
    weekdayStart: '09:00',
    weekdayEnd: '17:00',
    saturdayStart: '09:00',
    saturdayEnd: '13:30',
    ramadanStart: '09:00',
    ramadanEnd: '14:30',
    ramadanStartDate: null,
    ramadanEndDate: null,
    pwaInstallEnabled: false,
};

export default function SettingsClient({ locale }: { locale: string }) {
    const t = useTranslations('workSchedule');
    const router = useRouter();
    const { user, ready } = useRequireAuth(locale);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<WorkScheduleSettings>(DEFAULT_SETTINGS);

    const isAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/settings/work-schedule');
            setSettings((prev) => ({ ...prev, ...res.data }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!ready) return;
        if (!isAdmin) {
            router.replace(`/${locale}`);
            return;
        }
        fetchSettings();
    }, [isAdmin, locale, ready, router]);

    const rangeHint = useMemo(() => {
        if (!settings.ramadanStartDate || !settings.ramadanEndDate) return '';
        return t('rangeHint', { start: settings.ramadanStartDate, end: settings.ramadanEndDate });
    }, [settings.ramadanEndDate, settings.ramadanStartDate, t]);

    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل الإعدادات...' : 'Loading settings...'} />;
    }
    if (!isAdmin) return null;

    const update = (key: keyof WorkScheduleSettings, value: any) =>
        setSettings((prev) => ({ ...prev, [key]: value }));

    const save = async () => {
        if (settings.activeMode === 'RAMADAN' && (!settings.ramadanStartDate || !settings.ramadanEndDate)) {
            toast.error(t('rangeMissing'));
            return;
        }
        setSaving(true);
        try {
            await api.put('/settings/work-schedule', settings);
            toast.success(t('saved'));
            fetchSettings();
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="px-6 pb-12 space-y-6">
            <section className="card p-5 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">{t('title')}</h2>
                    <p className="text-sm text-ink/60">{t('description')}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-3 rounded-2xl border border-ink/10 bg-white/70 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('activeModeLabel')}</p>
                        <label className="flex items-center gap-3 text-sm">
                            <input
                                type="radio"
                                name="activeMode"
                                checked={settings.activeMode === 'NORMAL'}
                                onChange={() => update('activeMode', 'NORMAL')}
                            />
                            {t('modeNormal')}
                        </label>
                        <label className="flex items-center gap-3 text-sm">
                            <input
                                type="radio"
                                name="activeMode"
                                checked={settings.activeMode === 'RAMADAN'}
                                onChange={() => update('activeMode', 'RAMADAN')}
                            />
                            {t('modeRamadan')}
                        </label>

                        <div className="pt-2 space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('ramadanRange')}</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {t('ramadanStart')}
                                    <input
                                        type="date"
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={settings.ramadanStartDate || ''}
                                        onChange={(e) => update('ramadanStartDate', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {t('ramadanEnd')}
                                    <input
                                        type="date"
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={settings.ramadanEndDate || ''}
                                        onChange={(e) => update('ramadanEndDate', e.target.value)}
                                    />
                                </label>
                            </div>
                            {rangeHint ? (
                                <p className="text-xs text-ink/60">{rangeHint}</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-ink/10 bg-white/70 p-4">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('weekdayHours')}</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {t('startTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={settings.weekdayStart}
                                        onChange={(e) => update('weekdayStart', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {t('endTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={settings.weekdayEnd}
                                        onChange={(e) => update('weekdayEnd', e.target.value)}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('saturdayHours')}</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {t('startTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={settings.saturdayStart}
                                        onChange={(e) => update('saturdayStart', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {t('endTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={settings.saturdayEnd}
                                        onChange={(e) => update('saturdayEnd', e.target.value)}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('ramadanHours')}</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {t('startTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={settings.ramadanStart}
                                        onChange={(e) => update('ramadanStart', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {t('endTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={settings.ramadanEnd}
                                        onChange={(e) => update('ramadanEnd', e.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-ink/10 bg-white/70 p-4">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('pwaTitle')}</p>
                            <p className="text-sm text-ink/60">{t('pwaDescription')}</p>
                        </div>
                        <label className="flex items-center gap-3 text-sm">
                            <input
                                type="checkbox"
                                checked={settings.pwaInstallEnabled}
                                onChange={(e) => update('pwaInstallEnabled', e.target.checked)}
                            />
                            {t('pwaInstallLabel')}
                        </label>
                        <p className="text-xs text-ink/60">{t('pwaInstallHint')}</p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button className="btn-primary" onClick={save} disabled={saving}>
                        {saving ? t('saving') : t('save')}
                    </button>
                </div>
            </section>
        </main>
    );
}
