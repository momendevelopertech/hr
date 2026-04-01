'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import PageLoader from './PageLoader';
import ConfirmDialog from './ConfirmDialog';
import NotificationTemplatesManager from './NotificationTemplatesManager';
import { getDefaultNotificationTemplates, NotificationTemplateMap } from '@/lib/notification-template-catalog';

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
    evolutionApiBaseUrl: string;
    evolutionApiKeyConfigured?: boolean;
    notificationTemplates: NotificationTemplateMap;
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
    evolutionApiBaseUrl: '',
    evolutionApiKeyConfigured: false,
    notificationTemplates: getDefaultNotificationTemplates(),
};

export default function SettingsClient({ locale }: { locale: string }) {
    const t = useTranslations('workSchedule');
    const tCommon = useTranslations('common');
    const router = useRouter();
    const { user, ready } = useRequireAuth(locale);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<WorkScheduleSettings>(DEFAULT_SETTINGS);
    const [evolutionApiKey, setEvolutionApiKey] = useState('');
    const [resetOpen, setResetOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    const isAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/settings/work-schedule');
            setSettings((prev) => ({
                ...prev,
                ...res.data,
                notificationTemplates: res.data.notificationTemplates || prev.notificationTemplates,
            }));
            setEvolutionApiKey('');
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
            const { evolutionApiKeyConfigured: _evolutionApiKeyConfigured, ...payload } = settings;
            await api.put('/settings/work-schedule', {
                ...payload,
                ...(evolutionApiKey.trim() ? { evolutionApiKey: evolutionApiKey.trim() } : {}),
            });
            toast.success(t('saved'));
            fetchSettings();
        } finally {
            setSaving(false);
        }
    };

    const runReset = async () => {
        if (resetting) return;
        setResetting(true);
        try {
            await api.post('/settings/reset-data');
            toast.success(t('dataResetSuccess'));
        } catch {
            toast.error(t('dataResetFailed'));
        } finally {
            setResetting(false);
            setResetOpen(false);
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
                    <div className="surface-panel space-y-3 rounded-2xl p-4">
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
                                        className="field mt-1 w-full px-3 py-2"
                                        value={settings.ramadanStartDate || ''}
                                        onChange={(e) => update('ramadanStartDate', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {t('ramadanEnd')}
                                    <input
                                        type="date"
                                        className="field mt-1 w-full px-3 py-2"
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

                    <div className="surface-panel space-y-3 rounded-2xl p-4">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('weekdayHours')}</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {t('startTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="field mt-1 w-full px-3 py-2"
                                        value={settings.weekdayStart}
                                        onChange={(e) => update('weekdayStart', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {t('endTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="field mt-1 w-full px-3 py-2"
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
                                        className="field mt-1 w-full px-3 py-2"
                                        value={settings.saturdayStart}
                                        onChange={(e) => update('saturdayStart', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {t('endTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="field mt-1 w-full px-3 py-2"
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
                                        className="field mt-1 w-full px-3 py-2"
                                        value={settings.ramadanStart}
                                        onChange={(e) => update('ramadanStart', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {t('endTime')}
                                    <input
                                        type="time"
                                        step={900}
                                        className="field mt-1 w-full px-3 py-2"
                                        value={settings.ramadanEnd}
                                        onChange={(e) => update('ramadanEnd', e.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="surface-panel space-y-3 rounded-2xl p-4">
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

                    <div className="surface-panel space-y-3 rounded-2xl p-4">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('evolutionTitle')}</p>
                            <p className="text-sm text-ink/60">{t('evolutionDescription')}</p>
                        </div>
                        <label className="text-sm">
                            {t('evolutionBaseUrl')}
                            <input
                                type="url"
                                className="field mt-1 w-full px-3 py-2"
                                value={settings.evolutionApiBaseUrl}
                                onChange={(e) => update('evolutionApiBaseUrl', e.target.value)}
                                placeholder="http://YOUR_VPS_IP:8080"
                            />
                        </label>
                        <label className="text-sm">
                            {t('evolutionApiKey')}
                            <input
                                type="password"
                                className="field mt-1 w-full px-3 py-2"
                                value={evolutionApiKey}
                                onChange={(e) => setEvolutionApiKey(e.target.value)}
                                placeholder={settings.evolutionApiKeyConfigured ? t('evolutionApiKeyConfigured') : ''}
                                autoComplete="new-password"
                            />
                        </label>
                        <p className="text-xs text-ink/60">
                            {settings.evolutionApiKeyConfigured ? t('evolutionApiKeySaved') : t('evolutionApiKeyHint')}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button className="btn-primary" onClick={save} disabled={saving}>
                        {saving ? t('saving') : t('save')}
                    </button>
                </div>
            </section>

            <NotificationTemplatesManager
                locale={locale}
                value={settings.notificationTemplates}
                onChange={(notificationTemplates) => update('notificationTemplates', notificationTemplates)}
            />

            <div className="flex justify-end">
                <button className="btn-primary" onClick={save} disabled={saving}>
                    {saving ? t('saving') : t('save')}
                </button>
            </div>

            <section className="card p-5 space-y-3">
                <div>
                    <h2 className="text-lg font-semibold">{t('dataResetTitle')}</h2>
                    <p className="text-sm text-ink/60">{t('dataResetDescription')}</p>
                </div>
                <div className="flex justify-end">
                    <button className="btn-danger" onClick={() => setResetOpen(true)}>
                        {t('dataResetCta')}
                    </button>
                </div>
            </section>

            <ConfirmDialog
                open={resetOpen}
                title={t('dataResetTitle')}
                message={t('dataResetConfirm')}
                confirmLabel={resetting ? t('dataResetRunning') : t('dataResetCta')}
                cancelLabel={tCommon('cancel')}
                confirmDisabled={resetting}
                onConfirm={runReset}
                onCancel={() => setResetOpen(false)}
            />
        </main>
    );
}
