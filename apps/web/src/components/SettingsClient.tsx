'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import PageLoader from './PageLoader';
import ConfirmDialog from './ConfirmDialog';
import NotificationTemplatesManager from './NotificationTemplatesManager';
import { getDefaultNotificationTemplates, NotificationTemplateMap } from '@/lib/notification-template-catalog';
import { getDefaultCalendarOffDays, sortCalendarOffDays, type CalendarOffDayRule, type CalendarOffDayType } from './calendar/companyOffDays';

type NotificationDeliveryPreference = 'BOTH' | 'EMAIL_ONLY' | 'WHATSAPP_ONLY';
type SettingsTabId = 'profile' | 'schedule' | 'calendar' | 'notifications' | 'integrations' | 'danger';
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
type PersonalSettingsForm = {
    fullName: string;
    fullNameAr: string;
    email: string;
    phone: string;
    notificationDeliveryPreference: NotificationDeliveryPreference;
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
    calendarOffDays: getDefaultCalendarOffDays(),
};
const DEFAULT_PERSONAL: PersonalSettingsForm = {
    fullName: '',
    fullNameAr: '',
    email: '',
    phone: '',
    notificationDeliveryPreference: 'BOTH',
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
    const tChat = useTranslations('chat');
    const { user, ready } = useRequireAuth(locale);
    const setUser = useAuthStore((state) => state.setUser);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [profile, setProfile] = useState(DEFAULT_PERSONAL);
    const [evolutionApiKey, setEvolutionApiKey] = useState('');
    const [resetOpen, setResetOpen] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');

    const isAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    useEffect(() => {
        if (!user) return;
        setProfile({
            fullName: user.fullName || '',
            fullNameAr: user.fullNameAr || '',
            email: user.email || '',
            phone: user.phone || '',
            notificationDeliveryPreference: user.notificationDeliveryPreference || 'BOTH',
        });
    }, [user]);

    useEffect(() => {
        if (!ready) return;
        if (!isAdmin) {
            setLoading(false);
            return;
        }
        (async () => {
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
        })();
    }, [isAdmin, ready]);

    const tabs = useMemo(() => [
        { id: 'profile' as const, label: t('tabProfile') },
        ...(isAdmin ? [
            { id: 'schedule' as const, label: t('tabSchedule') },
            { id: 'calendar' as const, label: t('tabCalendar') },
            { id: 'notifications' as const, label: t('tabNotifications') },
            { id: 'integrations' as const, label: t('tabIntegrations') },
            { id: 'danger' as const, label: t('tabDanger') },
        ] : []),
    ], [isAdmin, t]);

    useEffect(() => {
        if (tabs.some((tab) => tab.id === activeTab)) return;
        setActiveTab(tabs[0]?.id || 'profile');
    }, [activeTab, tabs]);

    if (!ready || (isAdmin && loading)) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل الإعدادات...' : 'Loading settings...'} />;
    }
    if (!user) return null;

    const updateSettings = (key: keyof WorkScheduleSettings, value: any) => setSettings((prev) => ({ ...prev, [key]: value }));
    const updateProfile = (key: keyof PersonalSettingsForm, value: string) => setProfile((prev) => ({ ...prev, [key]: value }));
    const rangeHint = settings.ramadanStartDate && settings.ramadanEndDate ? t('rangeHint', { start: settings.ramadanStartDate, end: settings.ramadanEndDate }) : '';
    const timeGroups = [
        { key: 'weekdayHours', start: 'weekdayStart', end: 'weekdayEnd' },
        { key: 'saturdayHours', start: 'saturdayStart', end: 'saturdayEnd' },
        { key: 'ramadanHours', start: 'ramadanStart', end: 'ramadanEnd' },
    ] as const;

    const roleLabels: Record<string, string> = {
        SUPER_ADMIN: t('roleSuperAdmin'),
        HR_ADMIN: t('roleHrAdmin'),
        MANAGER: t('roleManager'),
        BRANCH_SECRETARY: t('roleBranchSecretary'),
        SUPPORT: t('roleSupport'),
        EMPLOYEE: t('roleEmployee'),
    };
    const generalInfo = [
        { label: t('profileEmployeeNumber'), value: user.employeeNumber || t('profileUnavailable') },
        { label: t('profileRole'), value: roleLabels[user.role] || user.role },
        { label: t('profileDepartment'), value: locale === 'ar' ? user.department?.nameAr || user.department?.name || t('profileUnavailable') : user.department?.name || user.department?.nameAr || t('profileUnavailable') },
        { label: t('profileBranch'), value: user.governorate === 'CAIRO' ? tChat('branchCairo') : user.governorate === 'ALEXANDRIA' ? tChat('branchAlexandria') : t('profileUnavailable') },
        { label: t('profileJobTitle'), value: locale === 'ar' ? user.jobTitleAr || user.jobTitle || t('profileUnavailable') : user.jobTitle || user.jobTitleAr || t('profileUnavailable') },
        { label: t('profileWorkflowMode'), value: user.workflowMode === 'SANDBOX' ? t('workflowSandbox') : t('workflowApproval') },
    ];
    const deliveryOptions = [
        { value: 'BOTH' as const, label: t('deliveryBoth'), hint: t('deliveryBothHint') },
        { value: 'EMAIL_ONLY' as const, label: t('deliveryEmailOnly'), hint: t('deliveryEmailOnlyHint') },
        { value: 'WHATSAPP_ONLY' as const, label: t('deliveryWhatsAppOnly'), hint: t('deliveryWhatsAppOnlyHint') },
    ];

    const saveProfile = async () => {
        const payload = {
            fullName: profile.fullName.trim(),
            fullNameAr: profile.fullNameAr.trim() || undefined,
            email: profile.email.trim(),
            phone: profile.phone.trim() || undefined,
            notificationDeliveryPreference: profile.notificationDeliveryPreference,
        };
        if (!payload.fullName || !payload.email) return toast.error(t('profileRequiredFields'));
        if (payload.notificationDeliveryPreference === 'WHATSAPP_ONLY' && !payload.phone) return toast.error(t('profileWhatsappRequired'));
        setProfileSaving(true);
        try {
            const res = await api.patch('/users/me/profile', payload);
            setUser(res.data);
            toast.success(t('profileSaved'));
        } catch (error: any) {
            toast.error(typeof error?.response?.data?.message === 'string' ? error.response.data.message : t('profileSaveFailed'));
        } finally {
            setProfileSaving(false);
        }
    };

    const saveSystemSettings = async () => {
        if (settings.activeMode === 'RAMADAN' && (!settings.ramadanStartDate || !settings.ramadanEndDate)) return toast.error(t('rangeMissing'));
        const invalidOffDay = settings.calendarOffDays.find((rule) => !rule.nameAr.trim() || !rule.nameEn.trim() || !rule.startDate || !rule.endDate || rule.endDate < rule.startDate);
        if (invalidOffDay) return toast.error(t('calendarOffDaysInvalid'));
        setSaving(true);
        try {
            const { evolutionApiKeyConfigured: _evolutionApiKeyConfigured, ...payload } = settings;
            await api.put('/settings/work-schedule', {
                ...payload,
                calendarOffDays: sortCalendarOffDays(payload.calendarOffDays),
                ...(evolutionApiKey.trim() ? { evolutionApiKey: evolutionApiKey.trim() } : {}),
            });
            toast.success(t('saved'));
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
                        <h2 className="text-lg font-semibold">{isAdmin ? t('title') : t('profilePageTitle')}</h2>
                        <p className="text-sm text-ink/60">{isAdmin ? t('description') : t('profilePageDescription')}</p>
                    </div>
                    {activeTab !== 'danger' ? <button className="btn-primary" onClick={activeTab === 'profile' ? saveProfile : saveSystemSettings} disabled={activeTab === 'profile' ? profileSaving : saving}>{activeTab === 'profile' ? (profileSaving ? t('profileSaving') : t('profileSave')) : (saving ? t('saving') : t('save'))}</button> : null}
                </div>
                <div className="rounded-[28px] border border-ink/10 bg-white/80 p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('tabsLabel')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {tabs.map((tab) => <button key={tab.id} type="button" className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-ink text-white shadow-sm' : 'btn-outline bg-transparent'}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
                    </div>
                    <p className="mt-3 text-sm text-ink/60">{isAdmin ? t('tabsHint') : t('profileTabsHint')}</p>
                </div>
                {activeTab === 'profile' ? (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                        <div className="surface-panel space-y-4 rounded-2xl p-4">
                            <div><p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('profilePersonalTitle')}</p><p className="text-sm text-ink/60">{t('profilePersonalDescription')}</p></div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">{t('profileFullName')}<input type="text" className="field mt-1 w-full px-3 py-2" value={profile.fullName} onChange={(e) => updateProfile('fullName', e.target.value)} /></label>
                                <label className="text-sm">{t('profileFullNameAr')}<input type="text" className="field mt-1 w-full px-3 py-2" value={profile.fullNameAr} onChange={(e) => updateProfile('fullNameAr', e.target.value)} /></label>
                                <label className="text-sm">{t('profileEmail')}<input type="email" className="field mt-1 w-full px-3 py-2" value={profile.email} onChange={(e) => updateProfile('email', e.target.value)} /></label>
                                <label className="text-sm">{t('profilePhone')}<input type="tel" inputMode="numeric" className="field mt-1 w-full px-3 py-2" value={profile.phone} onChange={(e) => updateProfile('phone', e.target.value)} /></label>
                            </div>
                            <p className="text-xs text-ink/60">{t('profileFullNameHint')}</p>
                        </div>
                        <div className="surface-panel space-y-4 rounded-2xl p-4">
                            <div><p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('profileGeneralTitle')}</p><p className="text-sm text-ink/60">{t('profileGeneralDescription')}</p></div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {generalInfo.map((item) => <div key={item.label} className="rounded-2xl border border-ink/10 bg-white/85 px-4 py-3 shadow-sm"><p className="text-xs uppercase tracking-[0.18em] text-ink/45">{item.label}</p><p className="mt-2 text-sm font-semibold text-ink">{item.value}</p></div>)}
                            </div>
                            <div className="space-y-3 pt-2">
                                <div><p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('profileNotificationsTitle')}</p><p className="text-sm text-ink/60">{t('profileNotificationsDescription')}</p></div>
                                <div className="grid gap-2">
                                    {deliveryOptions.map((option) => <button key={option.value} type="button" className={`rounded-2xl border px-4 py-3 text-start transition ${profile.notificationDeliveryPreference === option.value ? 'border-ink bg-ink text-white shadow-sm' : 'border-ink/10 bg-white/85 text-ink hover:border-ink/30'}`} onClick={() => updateProfile('notificationDeliveryPreference', option.value)}><div className="text-sm font-semibold">{option.label}</div><div className={`mt-1 text-xs ${profile.notificationDeliveryPreference === option.value ? 'text-white/75' : 'text-ink/60'}`}>{option.hint}</div></button>)}
                                </div>
                                <p className="text-xs text-ink/60">{t('profileNotificationsHint')}</p>
                            </div>
                        </div>
                    </div>
                ) : null}
                {activeTab === 'schedule' ? (
                    <>
                        <div className="surface-panel space-y-3 rounded-2xl p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('activeModeLabel')}</p>
                            <label className="flex items-center gap-3 text-sm"><input type="radio" name="activeMode" checked={settings.activeMode === 'NORMAL'} onChange={() => updateSettings('activeMode', 'NORMAL')} />{t('modeNormal')}</label>
                            <label className="flex items-center gap-3 text-sm"><input type="radio" name="activeMode" checked={settings.activeMode === 'RAMADAN'} onChange={() => updateSettings('activeMode', 'RAMADAN')} />{t('modeRamadan')}</label>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">{t('ramadanStart')}<input type="date" className="field mt-1 w-full px-3 py-2" value={settings.ramadanStartDate || ''} onChange={(e) => updateSettings('ramadanStartDate', e.target.value)} /></label>
                                <label className="text-sm">{t('ramadanEnd')}<input type="date" className="field mt-1 w-full px-3 py-2" value={settings.ramadanEndDate || ''} onChange={(e) => updateSettings('ramadanEndDate', e.target.value)} /></label>
                            </div>
                            {rangeHint ? <p className="text-xs text-ink/60">{rangeHint}</p> : null}
                        </div>
                        <div className="surface-panel space-y-4 rounded-2xl p-4">
                            {timeGroups.map((group) => <div key={group.key} className="space-y-2"><p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t(group.key)}</p><div className="grid gap-3 md:grid-cols-2"><label className="text-sm">{t('startTime')}<input type="time" step={900} className="field mt-1 w-full px-3 py-2" value={settings[group.start]} onChange={(e) => updateSettings(group.start, e.target.value)} /></label><label className="text-sm">{t('endTime')}<input type="time" step={900} className="field mt-1 w-full px-3 py-2" value={settings[group.end]} onChange={(e) => updateSettings(group.end, e.target.value)} /></label></div></div>)}
                        </div>
                    </>
                ) : null}
                {activeTab === 'integrations' ? (
                    <>
                        <div className="surface-panel space-y-3 rounded-2xl p-4">
                            <div><p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('pwaTitle')}</p><p className="text-sm text-ink/60">{t('pwaDescription')}</p></div>
                            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.pwaInstallEnabled} onChange={(e) => updateSettings('pwaInstallEnabled', e.target.checked)} />{t('pwaInstallLabel')}</label>
                            <p className="text-xs text-ink/60">{t('pwaInstallHint')}</p>
                        </div>
                        <div className="surface-panel space-y-3 rounded-2xl p-4">
                            <div><p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('evolutionTitle')}</p><p className="text-sm text-ink/60">{t('evolutionDescription')}</p></div>
                            <label className="text-sm">{t('evolutionBaseUrl')}<input type="url" className="field mt-1 w-full px-3 py-2" value={settings.evolutionApiBaseUrl} onChange={(e) => updateSettings('evolutionApiBaseUrl', e.target.value)} placeholder="http://YOUR_VPS_IP:8080" /></label>
                            <label className="text-sm">{t('evolutionApiKey')}<input type="password" className="field mt-1 w-full px-3 py-2" value={evolutionApiKey} onChange={(e) => setEvolutionApiKey(e.target.value)} placeholder={settings.evolutionApiKeyConfigured ? t('evolutionApiKeyConfigured') : ''} autoComplete="new-password" /></label>
                            <p className="text-xs text-ink/60">{settings.evolutionApiKeyConfigured ? t('evolutionApiKeySaved') : t('evolutionApiKeyHint')}</p>
                        </div>
                    </>
                ) : null}
                {activeTab === 'calendar' ? <div className="surface-panel space-y-4 rounded-2xl p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('calendarOffDaysTitle')}</p><p className="text-sm text-ink/60">{t('calendarOffDaysDescription')}</p></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-outline" onClick={() => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays([...prev.calendarOffDays, createCalendarOffDayRule('holiday')]) }))}>{t('addHoliday')}</button><button type="button" className="btn-outline" onClick={() => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays([...prev.calendarOffDays, createCalendarOffDayRule('est1')]) }))}>{t('addEst1')}</button><button type="button" className="btn-outline" onClick={() => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays([...prev.calendarOffDays, createCalendarOffDayRule('est2')]) }))}>{t('addEst2')}</button></div></div><div className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-sm text-ink/70"><span className="font-semibold">{t('fridayOffDayTitle')}</span><span className="ms-2">{t('fridayOffDayDescription')}</span></div><div className="grid gap-3">{settings.calendarOffDays.map((rule) => <div key={rule.id} className="rounded-2xl border border-ink/10 bg-white/85 p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="text-sm xl:col-span-1">{t('offDayType')}<select className="field mt-1 w-full px-3 py-2" value={rule.type} onChange={(e) => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays(prev.calendarOffDays.map((item) => item.id === rule.id ? { ...item, type: e.target.value as CalendarOffDayType } : item)) }))}><option value="holiday">{t('typeHoliday')}</option><option value="est1">{t('typeEst1')}</option><option value="est2">{t('typeEst2')}</option></select></label><label className="text-sm xl:col-span-2">{t('nameAr')}<input type="text" className="field mt-1 w-full px-3 py-2" value={rule.nameAr} onChange={(e) => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays(prev.calendarOffDays.map((item) => item.id === rule.id ? { ...item, nameAr: e.target.value } : item)) }))} /></label><label className="text-sm xl:col-span-2">{t('nameEn')}<input type="text" className="field mt-1 w-full px-3 py-2" value={rule.nameEn} onChange={(e) => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays(prev.calendarOffDays.map((item) => item.id === rule.id ? { ...item, nameEn: e.target.value } : item)) }))} /></label><div className="flex items-end xl:col-span-1"><button type="button" className="btn-danger w-full" onClick={() => setSettings((prev) => ({ ...prev, calendarOffDays: prev.calendarOffDays.filter((item) => item.id !== rule.id) }))}>{t('removeOffDay')}</button></div><label className="text-sm xl:col-span-1">{t('startDateLabel')}<input type="date" className="field mt-1 w-full px-3 py-2" value={rule.startDate} onChange={(e) => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays(prev.calendarOffDays.map((item) => item.id === rule.id ? { ...item, startDate: e.target.value } : item)) }))} /></label><label className="text-sm xl:col-span-1">{t('endDateLabel')}<input type="date" className="field mt-1 w-full px-3 py-2" value={rule.endDate} onChange={(e) => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays(prev.calendarOffDays.map((item) => item.id === rule.id ? { ...item, endDate: e.target.value } : item)) }))} /></label><label className="flex items-center gap-3 rounded-xl border border-ink/10 px-3 py-2 text-sm xl:col-span-2"><input type="checkbox" checked={rule.isRecurringAnnual === true} onChange={(e) => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays(prev.calendarOffDays.map((item) => item.id === rule.id ? { ...item, isRecurringAnnual: e.target.checked } : item)) }))} />{t('repeatEveryYear')}</label><label className="flex items-center gap-3 rounded-xl border border-ink/10 px-3 py-2 text-sm xl:col-span-2"><input type="checkbox" checked={rule.enabled !== false} onChange={(e) => setSettings((prev) => ({ ...prev, calendarOffDays: sortCalendarOffDays(prev.calendarOffDays.map((item) => item.id === rule.id ? { ...item, enabled: e.target.checked } : item)) }))} />{t('enabledLabel')}</label></div></div>)}</div></div> : null}
            </section>
            {activeTab === 'notifications' ? <NotificationTemplatesManager locale={locale} value={settings.notificationTemplates} onChange={(notificationTemplates) => updateSettings('notificationTemplates', notificationTemplates)} /> : null}
            {activeTab === 'danger' ? <section className="card p-5 space-y-3"><div><h2 className="text-lg font-semibold">{t('dataResetTitle')}</h2><p className="text-sm text-ink/60">{t('dataResetDescription')}</p></div><div className="flex justify-end"><button className="btn-danger" onClick={() => setResetOpen(true)}>{t('dataResetCta')}</button></div></section> : null}
            <ConfirmDialog open={resetOpen} title={t('dataResetTitle')} message={t('dataResetConfirm')} confirmLabel={resetting ? t('dataResetRunning') : t('dataResetCta')} cancelLabel={tCommon('cancel')} confirmDisabled={resetting} onConfirm={runReset} onCancel={() => setResetOpen(false)} />
        </main>
    );
}
