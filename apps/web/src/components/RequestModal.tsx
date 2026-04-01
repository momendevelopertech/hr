'use client';

import { useEffect, useMemo, useState } from 'react';
import { addMinutes, format } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { NotebookPen } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { clearApiCache } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import DateRangeFilter from './DateRangeFilter';

type RequestType = 'leave' | 'absence' | 'permission' | 'mission' | 'note' | 'lateness';

type EmployeeOption = {
    id: string;
    fullName: string;
    fullNameAr?: string | null;
    employeeNumber?: string | null;
    isActive?: boolean;
};

type Props = {
    open: boolean;
    locale: 'en' | 'ar';
    date: Date | null;
    onClose: () => void;
    onSubmitted: () => void;
};

const missionTypeOptions = ['MORNING', 'DURING_DAY', 'EVENING', 'ALL_DAY'] as const;

type WorkScheduleMode = 'NORMAL' | 'RAMADAN';
type WorkScheduleSettings = {
    activeMode: WorkScheduleMode;
    weekdayStart: string;
    weekdayEnd: string;
    saturdayStart: string;
    saturdayEnd: string;
    ramadanStart: string;
    ramadanEnd: string;
    ramadanStartDate: string | null;
    ramadanEndDate: string | null;
};

const DEFAULT_SCHEDULE: WorkScheduleSettings = {
    activeMode: 'NORMAL',
    weekdayStart: '09:00',
    weekdayEnd: '17:00',
    saturdayStart: '09:00',
    saturdayEnd: '13:30',
    ramadanStart: '09:00',
    ramadanEnd: '14:30',
    ramadanStartDate: null,
    ramadanEndDate: null,
};

const parseDateOnly = (value?: string | null) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

const dateOnly = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export default function RequestModal({ open, date, onClose, onSubmitted, locale }: Props) {
    const t = useTranslations('requests');
    const tm = useTranslations('requestModal');
    const { user } = useAuthStore();
    const isSecretary = user?.role === 'BRANCH_SECRETARY';
    const isSandbox = user?.workflowMode === 'SANDBOX';
    const [type, setType] = useState<RequestType | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [schedule, setSchedule] = useState<WorkScheduleSettings>(DEFAULT_SCHEDULE);
    const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

    const dateValue = useMemo(() => {
        if (!date) return '';
        return format(date, 'yyyy-MM-dd');
    }, [date]);
    const dayName = useMemo(() => {
        if (!date) return '';
        const dateLocale = locale === 'ar' ? arSA : enUS;
        return format(date, 'EEEE', { locale: dateLocale });
    }, [date, locale]);
    useEffect(() => {
        if (!open || !user) return;
        api.get('/settings/work-schedule')
            .then((res) => setSchedule((prev) => ({ ...prev, ...res.data })))
            .catch(() => null);
    }, [open, user]);

    useEffect(() => {
        if (!open) return;
        setType(null);
        setFormData(date ? { startDate: dateValue, endDate: dateValue } : {});
    }, [open, date, dateValue]);

    useEffect(() => {
        if (!open) return;
        if (isSecretary) {
            setSelectedEmployeeId('');
        } else if (user?.id) {
            setSelectedEmployeeId(user.id);
        }
    }, [isSecretary, open, user?.id]);

    useEffect(() => {
        if (!open || !isSecretary) return;
        let active = true;
        setEmployeesLoading(true);
        api.get('/users', { params: { page: 1, limit: 100 } })
            .then((res) => {
                if (!active) return;
                setEmployeeOptions(res.data?.items || []);
            })
            .catch(() => {
                if (!active) return;
                setEmployeeOptions([]);
            })
            .finally(() => {
                if (!active) return;
                setEmployeesLoading(false);
            });
        return () => {
            active = false;
        };
    }, [isSecretary, open]);

    const permissionPreview = useMemo(() => {
        if (!date || type !== 'permission') return null;
        const hours = Number(formData.durationHours) || 0;
        const minutes = Number(formData.durationMinutes) || 0;
        const totalMinutes = Math.max(0, hours * 60 + minutes);
        if (totalMinutes <= 0) return null;
        const scope = formData.permissionScope || 'ARRIVAL';
        const dateLocale = locale === 'ar' ? arSA : enUS;
        const startDate = parseDateOnly(schedule.ramadanStartDate);
        const endDate = parseDateOnly(schedule.ramadanEndDate);
        const current = dateOnly(date);
        const isRamadan =
            schedule.activeMode === 'RAMADAN' &&
            startDate &&
            endDate &&
            current >= startDate &&
            current <= endDate;
        const isSaturday = date.getDay() === 6;
        const startTime = isRamadan
            ? schedule.ramadanStart
            : isSaturday
                ? schedule.saturdayStart
                : schedule.weekdayStart;
        const endTime = isRamadan
            ? schedule.ramadanEnd
            : isSaturday
                ? schedule.saturdayEnd
                : schedule.weekdayEnd;
        const base = new Date(date);
        const [startHour, startMinute] = startTime.split(':').map((part) => Number(part));
        const [endHour, endMinute] = endTime.split(':').map((part) => Number(part));
        if (scope === 'ARRIVAL') {
            base.setHours(startHour || 0, startMinute || 0, 0, 0);
            const arrival = addMinutes(base, totalMinutes);
            const time = format(arrival, 'h:mm a', { locale: dateLocale });
            return tm('permissionConfirmArrival', { time });
        }
        base.setHours(endHour || 0, endMinute || 0, 0, 0);
        const leave = addMinutes(base, -totalMinutes);
        const time = format(leave, 'h:mm a', { locale: dateLocale });
        return tm('permissionConfirmDeparture', { time });
    }, [date, formData.durationHours, formData.durationMinutes, formData.permissionScope, locale, schedule, tm, type]);

    const latenessPreview = useMemo(() => {
        if (!date || type !== 'lateness') return null;
        const minutesLate = Number(formData.latenessMinutes) || 0;
        if (minutesLate <= 0) return null;
        const dateLocale = locale === 'ar' ? arSA : enUS;
        const startDate = parseDateOnly(schedule.ramadanStartDate);
        const endDate = parseDateOnly(schedule.ramadanEndDate);
        const current = dateOnly(date);
        const isRamadan =
            schedule.activeMode === 'RAMADAN' &&
            startDate &&
            endDate &&
            current >= startDate &&
            current <= endDate;
        const isSaturday = date.getDay() === 6;
        const startTime = isRamadan
            ? schedule.ramadanStart
            : isSaturday
                ? schedule.saturdayStart
                : schedule.weekdayStart;
        const base = new Date(date);
        const [startHour, startMinute] = startTime.split(':').map((part) => Number(part));
        base.setHours(startHour || 0, startMinute || 0, 0, 0);
        const arrival = addMinutes(base, minutesLate);
        const time = format(arrival, 'h:mm a', { locale: dateLocale });
        return tm('latenessConfirm', { time });
    }, [date, formData.latenessMinutes, locale, schedule, tm, type]);

    if (!open) return null;

    const update = (key: string, value: any) => setFormData((prev) => ({ ...prev, [key]: value }));
    const resolveErrorMessage = (error: any) => {
        const raw = error?.message || (locale === 'ar' ? 'تعذر تنفيذ الطلب.' : 'Unable to complete your request.');
        if (typeof raw === 'string' && locale === 'ar') {
            const match = raw.match(/Insufficient permission hours\. Available: ([0-9.]+)h, Requested: ([0-9.]+)h/);
            if (match) {
                return `لا توجد ساعات إذن متاحة. المتاح: ${match[1]} ساعة، المطلوب: ${match[2]} ساعة.`;
            }
        }
        return raw;
    };

    const submit = async () => {
        if (!date || !type) return;
        if (isSecretary && !selectedEmployeeId) {
            toast.error(tm('employeeRequired'));
            return;
        }
        const requestUserPayload = isSecretary && selectedEmployeeId ? { userId: selectedEmployeeId } : {};
        setLoading(true);
        try {
            if (type === 'leave') {
                await api.post('/leaves', {
                    leaveType: formData.leaveType || 'ANNUAL',
                    startDate: formData.startDate || dateValue,
                    endDate: formData.endDate || dateValue,
                    reason: '',
                    ...requestUserPayload,
                });
            }

            if (type === 'absence') {
                await api.post('/leaves', {
                    leaveType: 'ABSENCE_WITH_PERMISSION',
                    startDate: formData.startDate || dateValue,
                    endDate: formData.endDate || dateValue,
                    reason: '',
                    ...requestUserPayload,
                });
            }

            if (type === 'permission') {
                const durationMinutes = Math.max(
                    0,
                    (Number(formData.durationHours) || 0) * 60 + (Number(formData.durationMinutes) || 0),
                );
                if (durationMinutes <= 0) {
                    toast.error(tm('permissionDurationError'));
                    setLoading(false);
                    return;
                }
                const permissionScope = formData.permissionScope || 'ARRIVAL';
                await api.post('/permissions', {
                    permissionScope,
                    durationMinutes,
                    permissionType: permissionScope === 'ARRIVAL' ? 'LATE_ARRIVAL' : 'EARLY_LEAVE',
                    requestDate: dateValue,
                    reason: '',
                    ...requestUserPayload,
                });
            }

            if (type === 'mission') {
                const missionType = formData.missionType || 'ALL_DAY';
                const missionTo = formData.missionTo || '';
                const missionPurpose = formData.missionPurpose || '';
                const payloadReason = `Mission Type: ${missionType}\nMission To: ${missionTo}\nPurpose: ${missionPurpose}`;

                await api.post('/leaves', {
                    leaveType: 'MISSION',
                    startDate: formData.startDate || dateValue,
                    endDate: formData.endDate || dateValue,
                    reason: payloadReason,
                    ...requestUserPayload,
                });
            }

            if (type === 'note') {
                await api.post('/notes', {
                    date: dateValue,
                    title: formData.noteTitle || '',
                    body: formData.noteBody || '',
                });
            }

            if (type === 'lateness') {
                const minutesLate = Math.max(0, Math.round(Number(formData.latenessMinutes || 0)));
                if (!minutesLate) {
                    toast.error(tm('latenessMinutesError'));
                    setLoading(false);
                    return;
                }
                await api.post('/lateness', {
                    date: dateValue,
                    minutesLate,
                    ...requestUserPayload,
                });
            }

            clearApiCache();
            onSubmitted();
            onClose();
            setType(null);
            setFormData({});

            if (type === 'note') {
                toast.success(tm('noteSaved'));
            } else if (type === 'lateness') {
                toast.success(tm('latenessSaved'));
            } else if (!isSecretary && isSandbox) {
                toast.success(tm('autoApprovedToast'));
            } else {
                toast.success(tm('pendingToast'));
            }
        } catch (error: any) {
            toast.error(resolveErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="overlay-backdrop fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="modal-shell w-full max-w-2xl rounded-3xl p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{t('new')}</h2>
                    <button className="btn-outline" onClick={onClose}>{tm('close')}</button>
                </div>

                <p className="mt-3 text-sm text-ink/70">
                    {tm('selectedDate')}: <span className="font-semibold">{dateValue}</span>
                    {dayName ? <span className="ml-2 text-ink/60">- {dayName}</span> : null}
                </p>

                {isSecretary && (
                    <div className="surface-panel mt-3 rounded-2xl p-3">
                        <label className="text-sm">
                            {tm('employeeLabel')}
                            <select
                                className="field mt-2 w-full px-3 py-2"
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                disabled={employeesLoading}
                            >
                                <option value="">
                                    {employeesLoading ? tm('employeeLoading') : tm('employeePlaceholder')}
                                </option>
                                {employeeOptions.map((emp) => {
                                    const displayName = locale === 'ar' ? emp.fullNameAr || emp.fullName : emp.fullName;
                                    const number = emp.employeeNumber ? ` #${emp.employeeNumber}` : '';
                                    return (
                                        <option key={emp.id} value={emp.id}>
                                            {displayName}{number}
                                        </option>
                                    );
                                })}
                            </select>
                        </label>
                    </div>
                )}

                {!isSecretary && isSandbox && (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                        {tm('sandboxBanner')}
                    </div>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr]">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{tm('pickTypeTitle')}</p>
                            <button className={`toggle-option w-full rounded-xl px-4 py-2.5 text-sm font-semibold ${type === 'leave' ? 'is-active' : ''}`} onClick={() => setType('leave')}>
                                {tm('leaveRequest')}
                            </button>
                            <button className={`toggle-option w-full rounded-xl px-4 py-2.5 text-sm font-semibold ${type === 'absence' ? 'is-active' : ''}`} onClick={() => setType('absence')}>
                                {tm('absenceRequest')}
                            </button>
                            <button className={`toggle-option w-full rounded-xl px-4 py-2.5 text-sm font-semibold ${type === 'mission' ? 'is-active' : ''}`} onClick={() => setType('mission')}>
                                {tm('missionRequest')}
                            </button>
                            <button className={`toggle-option w-full rounded-xl px-4 py-2.5 text-sm font-semibold ${type === 'permission' ? 'is-active' : ''}`} onClick={() => setType('permission')}>
                                {tm('personalPermission')}
                            </button>
                        </div>

                        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-amber-900/70">{tm('employeeActionsTitle')}</p>
                            <div className="space-y-2">
                                <button
                                    className={`toggle-option tone-amber w-full rounded-xl px-3 py-2 text-sm font-semibold ${type === 'lateness'
                                        ? 'is-active'
                                        : ''
                                        }`}
                                    onClick={() => setType('lateness')}
                                >
                                    {tm('latenessRequest')}
                                </button>
                                <button
                                    className={`toggle-option tone-amber w-full rounded-xl px-3 py-2 text-sm font-semibold ${type === 'note'
                                        ? 'is-active'
                                        : ''
                                        }`}
                                    onClick={() => setType('note')}
                                >
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <NotebookPen className="h-4 w-4" />
                                        {tm('noteRequest')}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="surface-panel rounded-2xl p-4">
                        {!type && (
                            <p className="text-sm text-ink/60">{tm('pickTypeHint')}</p>
                        )}
                        {type && (
                            <div className="space-y-4">
                    {type === 'leave' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {tm('leaveType')}
                                    <select
                                        className="field mt-1 w-full px-3 py-2"
                                        value={formData.leaveType || 'ANNUAL'}
                                        onChange={(e) => update('leaveType', e.target.value)}
                                    >
                                        <option value="ANNUAL">{tm('leaveAnnual')}</option>
                                        <option value="CASUAL">{tm('leaveCasual')}</option>
                                    </select>
                                </label>
                                <label className="text-sm">
                                    {locale === 'ar' ? 'التاريخ / الفترة' : 'Date / Range'}
                                    <div className="mt-1">
                                        <DateRangeFilter
                                            locale={locale}
                                            from={formData.startDate || ''}
                                            to={formData.endDate || ''}
                                            onChange={({ from, to }) => {
                                                update('startDate', from);
                                                update('endDate', to);
                                            }}
                                        />
                                    </div>
                                </label>
                            </div>
                        </>
                    )}

                    {type === 'absence' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {locale === 'ar' ? 'التاريخ / الفترة' : 'Date / Range'}
                                    <div className="mt-1">
                                        <DateRangeFilter
                                            locale={locale}
                                            from={formData.startDate || ''}
                                            to={formData.endDate || ''}
                                            onChange={({ from, to }) => {
                                                update('startDate', from);
                                                update('endDate', to);
                                            }}
                                        />
                                    </div>
                                </label>
                            </div>
                        </>
                    )}

                    {type === 'permission' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {tm('permissionScope')}
                                    <select
                                        className="field mt-1 w-full px-3 py-2"
                                        value={formData.permissionScope || 'ARRIVAL'}
                                        onChange={(e) => update('permissionScope', e.target.value)}
                                    >
                                        <option value="ARRIVAL">{tm('permissionArrival')}</option>
                                        <option value="DEPARTURE">{tm('permissionDeparture')}</option>
                                    </select>
                                </label>
                                <label className="text-sm">
                                    {tm('permissionDuration')}
                                    <div className="mt-1 grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            className="field w-full px-3 py-2"
                                            placeholder={tm('durationHours')}
                                            value={formData.durationHours || ''}
                                            onChange={(e) => update('durationHours', e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            min={0}
                                            max={59}
                                            className="field w-full px-3 py-2"
                                            placeholder={tm('durationMinutes')}
                                            value={formData.durationMinutes || ''}
                                            onChange={(e) => update('durationMinutes', e.target.value)}
                                        />
                                    </div>
                                </label>
                            </div>
                            {permissionPreview && (
                                <div className="rounded-xl border border-ink/10 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    {permissionPreview}
                                </div>
                            )}
                        </>
                    )}

                    {type === 'lateness' && (
                        <>
                            <div className="space-y-2">
                                <p className="text-sm text-ink/70">{tm('latenessQuick')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {[2, 5, 10, 15, 30].map((minutes) => (
                                        <button
                                            key={minutes}
                                            className={`toggle-option tone-neutral rounded-xl px-4 py-2 text-sm font-semibold ${Number(formData.latenessMinutes) === minutes ? 'is-active' : ''}`}
                                            onClick={() => update('latenessMinutes', minutes)}
                                        >
                                            {tm('latenessMinutesValue', { minutes })}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <label className="text-sm">
                                {tm('latenessMinutes')}
                                <input
                                    type="number"
                                    min={1}
                                    className="field mt-1 w-full px-3 py-2"
                                    placeholder={tm('durationMinutes')}
                                    value={formData.latenessMinutes || ''}
                                    onChange={(e) => update('latenessMinutes', e.target.value)}
                                />
                            </label>
                            {latenessPreview && (
                                <div className="rounded-xl border border-ink/10 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    {latenessPreview}
                                </div>
                            )}
                        </>
                    )}

                    {type === 'mission' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {tm('missionType')}
                                    <select
                                        className="field mt-1 w-full px-3 py-2"
                                        value={formData.missionType || 'ALL_DAY'}
                                        onChange={(e) => update('missionType', e.target.value)}
                                    >
                                        {missionTypeOptions.map((opt) => (
                                            <option key={opt} value={opt}>{tm(`missionType_${opt}`)}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="text-sm">
                                    {locale === 'ar' ? 'التاريخ / الفترة' : 'Date / Range'}
                                    <div className="mt-1">
                                        <DateRangeFilter
                                            locale={locale}
                                            from={formData.startDate || ''}
                                            to={formData.endDate || ''}
                                            onChange={({ from, to }) => {
                                                update('startDate', from);
                                                update('endDate', to);
                                            }}
                                        />
                                    </div>
                                </label>
                            </div>
                            <label className="text-sm">
                                {tm('missionTo')}
                                <textarea
                                    rows={2}
                                    className="field mt-1 w-full px-3 py-2"
                                    onChange={(e) => update('missionTo', e.target.value)}
                                />
                            </label>
                            <label className="text-sm">
                                {tm('missionPurpose')}
                                <textarea
                                    rows={3}
                                    className="field mt-1 w-full px-3 py-2"
                                    onChange={(e) => update('missionPurpose', e.target.value)}
                                />
                            </label>
                        </>
                    )}

                    {type === 'note' && (
                        <>
                            <label className="text-sm">
                                {tm('noteTitle')}
                                <input
                                    className="field mt-1 w-full px-3 py-2"
                                    placeholder={tm('noteTitlePlaceholder')}
                                    value={formData.noteTitle || ''}
                                    onChange={(e) => update('noteTitle', e.target.value)}
                                />
                            </label>
                            <label className="text-sm">
                                {tm('noteBody')}
                                <textarea
                                    rows={4}
                                    className="field mt-1 w-full px-3 py-2"
                                    placeholder={tm('noteBodyPlaceholder')}
                                    value={formData.noteBody || ''}
                                    onChange={(e) => update('noteBody', e.target.value)}
                                />
                            </label>
                        </>
                    )}
                        </div>
                    )}
                </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button className="btn-outline" onClick={onClose}>{tm('cancel')}</button>
                    <button
                        className="btn-primary"
                        onClick={submit}
                        disabled={loading || !type || (isSecretary && !selectedEmployeeId)}
                    >
                        {loading ? tm('saving') : tm('submit')}
                    </button>
                </div>
            </div>
        </div>
    );
}


