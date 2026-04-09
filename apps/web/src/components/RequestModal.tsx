'use client';

import { useEffect, useMemo, useState } from 'react';
import { addMinutes, format } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { NotebookPen } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { clearApiCache } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { formatPermissionDuration } from '@/lib/permission-duration';
import DateRangeFilter from './DateRangeFilter';

type RequestType = 'leave' | 'absence' | 'permission' | 'mission' | 'note' | 'lateness';

type EmployeeOption = {
    id: string;
    fullName: string;
    fullNameAr?: string | null;
    employeeNumber?: string | null;
    isActive?: boolean;
};

type ChannelDelivery = {
    ok: boolean;
    recipient?: string;
    phone?: string;
    error?: string;
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
const MAX_PERMISSION_MINUTES = 4 * 60;
const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const parseDurationPart = (value: unknown, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return clampNumber(Math.floor(parsed), 0, max);
};

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
        const hours = parseDurationPart(formData.durationHours, 4);
        const minutes = parseDurationPart(formData.durationMinutes, 59);
        const totalMinutes = clampNumber(hours * 60 + minutes, 0, MAX_PERMISSION_MINUTES);
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
    const permissionDuration = useMemo(() => {
        const hours = parseDurationPart(formData.durationHours, 4);
        const minutes = parseDurationPart(formData.durationMinutes, 59);
        return {
            hours,
            minutes,
            totalMinutes: hours * 60 + minutes,
            minutesMax: hours >= 4 ? 0 : 59,
        };
    }, [formData.durationHours, formData.durationMinutes]);
    const permissionDurationInvalid = type === 'permission' && permissionDuration.totalMinutes > MAX_PERMISSION_MINUTES;

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
            const match = raw.match(/Insufficient permission hours\. Available: (.+), Requested: (.+)/);
            if (match) {
                const parseDurationToHours = (value: string) => {
                    const normalized = value.trim();
                    const hoursOnly = normalized.match(/^(\d+(?:\.\d+)?)h$/i);
                    if (hoursOnly) return Number(hoursOnly[1]);
                    const minutesOnly = normalized.match(/^(\d+)m$/i);
                    if (minutesOnly) return Number(minutesOnly[1]) / 60;
                    const hoursAndMinutes = normalized.match(/^(\d+)h\s+(\d+)m$/i);
                    if (hoursAndMinutes) return Number(hoursAndMinutes[1]) + (Number(hoursAndMinutes[2]) / 60);
                    return Number.NaN;
                };

                const availableHours = parseDurationToHours(match[1]);
                const requestedHours = parseDurationToHours(match[2]);
                const availableText = Number.isNaN(availableHours) ? match[1] : formatPermissionDuration(availableHours, 'ar');
                const requestedText = Number.isNaN(requestedHours) ? match[2] : formatPermissionDuration(requestedHours, 'ar');
                return `لا توجد ساعات إذن متاحة. المتاح: ${availableText}، المطلوب: ${requestedText}.`;
            }
            if (/already have a leave, absence, or mission request/i.test(raw)) {
                return 'لديك بالفعل طلب إجازة أو غياب بإذن أو مأمورية يتقاطع مع هذه التواريخ.';
            }
            if (/already have a permission request/i.test(raw)) {
                return 'لديك بالفعل طلب إذن في أحد هذه الأيام.';
            }
            if (/already have a permission request on this day/i.test(raw)) {
                return 'لديك بالفعل طلب إذن في هذا اليوم.';
            }
            if (/already have a leave, absence, or mission request on this date/i.test(raw)) {
                return 'لديك بالفعل طلب في هذا اليوم (إجازة/غياب بإذن/مأمورية).';
            }
        }
        return raw;
    };
    const getRequestSubmissionNotice = (response: any, summaryLine: string) => {
        const emailDelivery = response?.emailDelivery as ChannelDelivery | null | undefined;
        const whatsAppDelivery = response?.whatsAppDelivery as ChannelDelivery | null | undefined;
        const unknownReason = locale === 'ar' ? 'فشل غير معروف' : 'Unknown failure';
        const lines = [summaryLine];

        if (emailDelivery?.ok) {
            lines.push(tm('emailSentToast', {
                recipient: emailDelivery.recipient || '-',
            }));
        } else if (emailDelivery) {
            lines.push(tm('emailFailedToast', {
                recipient: emailDelivery.recipient || '-',
                reason: emailDelivery.error || unknownReason,
            }));
        }

        if (whatsAppDelivery?.ok) {
            lines.push(tm('whatsAppSentToast', {
                phone: whatsAppDelivery.phone || '-',
            }));
        } else if (whatsAppDelivery) {
            lines.push(tm('whatsAppFailedToast', {
                phone: whatsAppDelivery.phone || '-',
                reason: whatsAppDelivery.error || unknownReason,
            }));
        }

        if (emailDelivery == null && whatsAppDelivery == null) {
            lines.push(tm('deliveryStatusUnavailable'));
        }

        return {
            message: lines.join('\n'),
            hasFailure: Boolean(
                (emailDelivery && !emailDelivery.ok)
                || (whatsAppDelivery && !whatsAppDelivery.ok),
            ),
        };
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
            let responseData: any = null;

            if (type === 'leave') {
                responseData = (await api.post('/leaves', {
                    leaveType: formData.leaveType || 'ANNUAL',
                    startDate: formData.startDate || dateValue,
                    endDate: formData.endDate || dateValue,
                    reason: '',
                    ...requestUserPayload,
                })).data;
            }

            if (type === 'absence') {
                responseData = (await api.post('/leaves', {
                    leaveType: 'ABSENCE_WITH_PERMISSION',
                    startDate: formData.startDate || dateValue,
                    endDate: formData.endDate || dateValue,
                    reason: '',
                    ...requestUserPayload,
                })).data;
            }

            if (type === 'permission') {
                const { totalMinutes: durationMinutes } = permissionDuration;
                if (durationMinutes <= 0) {
                    toast.error(tm('permissionDurationError'));
                    setLoading(false);
                    return;
                }
                if (durationMinutes > MAX_PERMISSION_MINUTES) {
                    toast.error(tm('permissionDurationMaxError'));
                    setLoading(false);
                    return;
                }
                const permissionScope = formData.permissionScope || 'ARRIVAL';
                responseData = (await api.post('/permissions', {
                    permissionScope,
                    durationMinutes,
                    permissionType: permissionScope === 'ARRIVAL' ? 'LATE_ARRIVAL' : 'EARLY_LEAVE',
                    requestDate: dateValue,
                    reason: '',
                    ...requestUserPayload,
                })).data;
            }

            if (type === 'mission') {
                const missionType = formData.missionType || 'ALL_DAY';
                const missionTo = formData.missionTo || '';
                const missionPurpose = formData.missionPurpose || '';
                const payloadReason = `Mission Type: ${missionType}\nMission To: ${missionTo}\nPurpose: ${missionPurpose}`;

                responseData = (await api.post('/leaves', {
                    leaveType: 'MISSION',
                    startDate: formData.startDate || dateValue,
                    endDate: formData.endDate || dateValue,
                    reason: payloadReason,
                    ...requestUserPayload,
                })).data;
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
            } else {
                const summaryLine = !isSecretary && isSandbox
                    ? tm('autoApprovedToast')
                    : tm('pendingToast');
                const notice = getRequestSubmissionNotice(responseData, summaryLine);
                if (notice.hasFailure) {
                    toast(notice.message, { icon: '⚠️', duration: 12000 });
                } else {
                    toast.success(notice.message, { duration: 12000 });
                }
            }
        } catch (error: any) {
            toast.error(resolveErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center overflow-y-auto px-2 py-2 sm:items-center sm:px-4 sm:py-8">
            <div className="modal-shell w-full max-w-3xl max-h-[calc(100vh-1rem)] overflow-y-auto rounded-2xl p-4 sm:max-h-[92vh] sm:rounded-3xl sm:p-6">
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

                <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
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
                                            max={4}
                                            className="field w-full px-3 py-2"
                                            placeholder={tm('durationHours')}
                                            value={formData.durationHours ?? ''}
                                            onChange={(e) => {
                                                const nextHours = parseDurationPart(e.target.value, 4);
                                                const currentMinutes = parseDurationPart(formData.durationMinutes, 59);
                                                update('durationHours', nextHours);
                                                if (nextHours >= 4 && currentMinutes > 0) {
                                                    update('durationMinutes', 0);
                                                }
                                            }}
                                        />
                                        <input
                                            type="number"
                                            min={0}
                                            max={permissionDuration.minutesMax}
                                            className="field w-full px-3 py-2"
                                            placeholder={tm('durationMinutes')}
                                            value={formData.durationMinutes ?? ''}
                                            onChange={(e) => {
                                                const rawMinutes = parseDurationPart(e.target.value, 59);
                                                update('durationMinutes', Math.min(rawMinutes, permissionDuration.minutesMax));
                                            }}
                                        />
                                    </div>
                                </label>
                            </div>
                            {permissionDurationInvalid && (
                                <p className="text-sm text-rose-600">{tm('permissionDurationMaxError')}</p>
                            )}
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

                <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-ink/10 bg-[var(--surface-overlay)] pt-4">
                    <button className="btn-outline" onClick={onClose}>{tm('cancel')}</button>
                    <button
                        className="btn-primary"
                        onClick={submit}
                        disabled={loading || !type || (isSecretary && !selectedEmployeeId) || permissionDurationInvalid}
                    >
                        {loading ? tm('saving') : tm('submit')}
                    </button>
                </div>
            </div>
        </div>
    );
}
