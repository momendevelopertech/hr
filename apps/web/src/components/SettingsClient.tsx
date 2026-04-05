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
import { getDefaultCalendarOffDays, sortCalendarOffDays, type CalendarOffDayRule, type CalendarOffDayType } from './calendar/companyOffDays';

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
    calendarOffDays: CalendarOffDayRule[];
};

type SettingsTabId = 'schedule' | 'calendar' | 'notifications' | 'integrations' | 'danger';

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
    calendarOffDays: getDefaultCalendarOffDays(),
};

const createCalendarOffDayRule = (type: CalendarOffDayType): CalendarOffDayRule => ({
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    nameAr: type === 'holiday' ? 'إجازة جديدة' : type === 'est1' ? 'EST I' : 'EST II',
    nameEn: type === 'holiday' ? 'New holiday' : type === 'est1' ? 'EST I' : 'EST II',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    isRecurringAnnual: type !== 'holiday',
    enabled: true,
});

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
    const [activeTab, setActiveTab] = useState<SettingsTabId>('schedule');

    const isAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/settings/work-schedule');
            setSettings((prev) => ({
                ...prev,
                ...res.data,
                notificationTemplates: res.data.notificationTemplates || prev.notificationTemplates,
                calendarOffDays: sortCalendarOffDays(res.data.calendarOffDays || prev.calendarOffDays),
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

    const tabs = useMemo(
        () => [
            { id: 'schedule' as const, label: t('tabSchedule') },
            { id: 'calendar' as const, label: t('tabCalendar') },
            { id: 'notifications' as const, label: t('tabNotifications') },
            { id: 'integrations' as const, label: t('tabIntegrations') },
            { id: 'danger' as const, label: t('tabDanger') },
        ],
        [t],
    );

    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل الإعدادات...' : 'Loading settings...'} />;
    }
    if (!isAdmin) return null;

    const update = (key: keyof WorkScheduleSettings, value: any) =>
        setSettings((prev) => ({ ...prev, [key]: value }));

    const updateCalendarOffDay = (id: string, patch: Partial<CalendarOffDayRule>) => {
        setSettings((prev) => ({
            ...prev,
            calendarOffDays: sortCalendarOffDays(
                prev.calendarOffDays.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
            ),
        }));
    };

    const addCalendarOffDay = (type: CalendarOffDayType) => {
        setSettings((prev) => ({
            ...prev,
            calendarOffDays: sortCalendarOffDays([...prev.calendarOffDays, createCalendarOffDayRule(type)]),
        }));
    };

    const removeCalendarOffDay = (id: string) => {
        setSettings((prev) => ({
            ...prev,
            calendarOffDays: prev.calendarOffDays.filter((rule) => rule.id !== id),
        }));
    };

    const save = async () => {
        if (settings.activeMode === 'RAMADAN' && (!settings.ramadanStartDate || !settings.ramadanEndDate)) {
            toast.error(t('rangeMissing'));
            return;
        }
        const invalidOffDay = settings.calendarOffDays.find((rule) =>
            !rule.nameAr.trim() ||
            !rule.nameEn.trim() ||
            !rule.startDate ||
            !rule.endDate ||
            rule.endDate < rule.startDate,
        );
        if (invalidOffDay) {
            toast.error(t('calendarOffDaysInvalid'));
            return;
        }
        setSaving(true);
        try {
            const { evolutionApiKeyConfigured: _evolutionApiKeyConfigured, ...payload } = settings;
            await api.put('/settings/work-schedule', {
                ...payload,
                calendarOffDays: sortCalendarOffDays(payload.calendarOffDays),
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
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">{t('title')}</h2>
                        <p className="text-sm text-ink/60">{t('description')}</p>
                    </div>
                    {activeTab !== 'danger' ? (
                        <button className="btn-primary" onClick={save} disabled={saving}>
                            {saving ? t('saving') : t('save')}
                        </button>
                    ) : null}
                </div>

                <div className="rounded-[28px] border border-ink/10 bg-white/80 p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('tabsLabel')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-ink text-white shadow-sm' : 'btn-outline bg-transparent'}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-3 text-sm text-ink/60">{t('tabsHint')}</p>
                </div>

                {activeTab === 'schedule' ? (
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
                ) : null}

                {activeTab === 'schedule' ? (
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
                ) : null}

                {activeTab === 'integrations' ? (
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
                ) : null}

                {activeTab === 'integrations' ? (
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
                ) : null}
                {activeTab === 'calendar' ? (
                    <div className="surface-panel space-y-4 rounded-2xl p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('calendarOffDaysTitle')}</p>
                                <p className="text-sm text-ink/60">{t('calendarOffDaysDescription')}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className="btn-outline" onClick={() => addCalendarOffDay('holiday')}>
                                    {t('addHoliday')}
                                </button>
                                <button type="button" className="btn-outline" onClick={() => addCalendarOffDay('est1')}>
                                    {t('addEst1')}
                                </button>
                                <button type="button" className="btn-outline" onClick={() => addCalendarOffDay('est2')}>
                                    {t('addEst2')}
                                </button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-sm text-ink/70">
                            <span className="font-semibold">{t('fridayOffDayTitle')}</span>
                            <span className="ms-2">{t('fridayOffDayDescription')}</span>
                        </div>

                        <div className="grid gap-3">
                            {settings.calendarOffDays.map((rule) => (
                                <div key={rule.id} className="rounded-2xl border border-ink/10 bg-white/85 p-4 shadow-sm">
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                                        <label className="text-sm xl:col-span-1">
                                            {t('offDayType')}
                                            <select
                                                className="field mt-1 w-full px-3 py-2"
                                                value={rule.type}
                                                onChange={(e) => updateCalendarOffDay(rule.id, { type: e.target.value as CalendarOffDayType })}
                                            >
                                                <option value="holiday">{t('typeHoliday')}</option>
                                                <option value="est1">{t('typeEst1')}</option>
                                                <option value="est2">{t('typeEst2')}</option>
                                            </select>
                                        </label>
                                        <label className="text-sm xl:col-span-2">
                                            {t('nameAr')}
                                            <input
                                                type="text"
                                                className="field mt-1 w-full px-3 py-2"
                                                value={rule.nameAr}
                                                onChange={(e) => updateCalendarOffDay(rule.id, { nameAr: e.target.value })}
                                            />
                                        </label>
                                        <label className="text-sm xl:col-span-2">
                                            {t('nameEn')}
                                            <input
                                                type="text"
                                                className="field mt-1 w-full px-3 py-2"
                                                value={rule.nameEn}
                                                onChange={(e) => updateCalendarOffDay(rule.id, { nameEn: e.target.value })}
                                            />
                                        </label>
                                        <div className="flex items-end xl:col-span-1">
                                            <button type="button" className="btn-danger w-full" onClick={() => removeCalendarOffDay(rule.id)}>
                                                {t('removeOffDay')}
                                            </button>
                                        </div>
                                        <label className="text-sm xl:col-span-1">
                                            {t('startDateLabel')}
                                            <input
                                                type="date"
                                                className="field mt-1 w-full px-3 py-2"
                                                value={rule.startDate}
                                                onChange={(e) => updateCalendarOffDay(rule.id, { startDate: e.target.value })}
                                            />
                                        </label>
                                        <label className="text-sm xl:col-span-1">
                                            {t('endDateLabel')}
                                            <input
                                                type="date"
                                                className="field mt-1 w-full px-3 py-2"
                                                value={rule.endDate}
                                                onChange={(e) => updateCalendarOffDay(rule.id, { endDate: e.target.value })}
                                            />
                                        </label>
                                        <label className="flex items-center gap-3 rounded-xl border border-ink/10 px-3 py-2 text-sm xl:col-span-2">
                                            <input
                                                type="checkbox"
                                                checked={rule.isRecurringAnnual === true}
                                                onChange={(e) => updateCalendarOffDay(rule.id, { isRecurringAnnual: e.target.checked })}
                                            />
                                            {t('repeatEveryYear')}
                                        </label>
                                        <label className="flex items-center gap-3 rounded-xl border border-ink/10 px-3 py-2 text-sm xl:col-span-2">
                                            <input
                                                type="checkbox"
                                                checked={rule.enabled !== false}
                                                onChange={(e) => updateCalendarOffDay(rule.id, { enabled: e.target.checked })}
                                            />
                                            {t('enabledLabel')}
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </section>

            {activeTab === 'notifications' ? (
                <NotificationTemplatesManager
                    locale={locale}
                    value={settings.notificationTemplates}
                    onChange={(notificationTemplates) => update('notificationTemplates', notificationTemplates)}
                />
            ) : null}

            {activeTab === 'danger' ? (
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
            ) : null}

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
