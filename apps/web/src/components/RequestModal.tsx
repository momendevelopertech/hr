'use client';

import { useMemo, useState } from 'react';
import { addMinutes, format } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { NotebookPen } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useTranslations } from 'next-intl';

type RequestType = 'leave' | 'absence' | 'permission' | 'mission' | 'note';

type Props = {
    open: boolean;
    locale: 'en' | 'ar';
    date: Date | null;
    onClose: () => void;
    onSubmitted: () => void;
};

const missionTypeOptions = ['MORNING', 'DURING_DAY', 'EVENING', 'ALL_DAY'] as const;

export default function RequestModal({ open, date, onClose, onSubmitted, locale }: Props) {
    const t = useTranslations('requests');
    const tm = useTranslations('requestModal');
    const [type, setType] = useState<RequestType | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);

    const dateValue = useMemo(() => {
        if (!date) return '';
        return format(date, 'yyyy-MM-dd');
    }, [date]);
    const dayName = useMemo(() => {
        if (!date) return '';
        const dateLocale = locale === 'ar' ? arSA : enUS;
        return format(date, 'EEEE', { locale: dateLocale });
    }, [date, locale]);
    const permissionPreview = useMemo(() => {
        if (!date || type !== 'permission') return null;
        const hours = Number(formData.durationHours) || 0;
        const minutes = Number(formData.durationMinutes) || 0;
        const totalMinutes = Math.max(0, hours * 60 + minutes);
        if (totalMinutes <= 0) return null;
        const scope = formData.permissionScope || 'ARRIVAL';
        const base = new Date(date);
        if (scope === 'ARRIVAL') {
            base.setHours(9, 0, 0, 0);
            const arrival = addMinutes(base, totalMinutes);
            const time = format(arrival, 'h:mm a', { locale: locale === 'ar' ? arSA : enUS });
            return tm('permissionConfirmArrival', { time });
        }
        base.setHours(17, 0, 0, 0);
        const leave = addMinutes(base, -totalMinutes);
        const time = format(leave, 'h:mm a', { locale: locale === 'ar' ? arSA : enUS });
        return tm('permissionConfirmDeparture', { time });
    }, [date, formData.durationHours, formData.durationMinutes, formData.permissionScope, locale, tm, type]);

    if (!open) return null;

    const update = (key: string, value: any) => setFormData((prev) => ({ ...prev, [key]: value }));

    const submit = async () => {
        if (!date || !type) return;
        setLoading(true);
        try {
            if (type === 'leave') {
                await api.post('/leaves', {
                    leaveType: formData.leaveType || 'ANNUAL',
                    startDate: formData.startDate || dateValue,
                    endDate: formData.endDate || dateValue,
                    reason: '',
                });
            }

            if (type === 'absence') {
                await api.post('/leaves', {
                    leaveType: 'ABSENCE_WITH_PERMISSION',
                    startDate: formData.startDate || dateValue,
                    endDate: formData.endDate || dateValue,
                    reason: '',
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
                });
            }

            if (type === 'note') {
                await api.post('/notes', {
                    date: dateValue,
                    title: formData.noteTitle || '',
                    body: formData.noteBody || '',
                });
            }

            onSubmitted();
            onClose();
            setType(null);
            setFormData({});

            if (type === 'note') {
                toast.success(tm('noteSaved'));
            } else {
                toast.success(tm('pendingToast'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="card w-full max-w-2xl p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{t('new')}</h2>
                    <button className="btn-outline" onClick={onClose}>{tm('close')}</button>
                </div>

                <p className="mt-3 text-sm text-ink/70">
                    {tm('selectedDate')}: <span className="font-semibold">{dateValue}</span>
                    {dayName ? <span className="ml-2 text-ink/60">- {dayName}</span> : null}
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{tm('pickTypeTitle')}</p>
                        <button className={`btn-outline w-full ${type === 'permission' ? 'bg-ink/10' : ''}`} onClick={() => setType('permission')}>
                            {tm('personalPermission')}
                        </button>
                        <button className={`btn-outline w-full ${type === 'leave' ? 'bg-ink/10' : ''}`} onClick={() => setType('leave')}>
                            {tm('leaveRequest')}
                        </button>
                        <button className={`btn-outline w-full ${type === 'absence' ? 'bg-ink/10' : ''}`} onClick={() => setType('absence')}>
                            {tm('absenceRequest')}
                        </button>
                        <button className={`btn-outline w-full ${type === 'mission' ? 'bg-ink/10' : ''}`} onClick={() => setType('mission')}>
                            {tm('missionRequest')}
                        </button>
                        <button
                            className={`btn-outline w-full py-3 text-base ${type === 'note' ? 'bg-amber-200/60 border-amber-200 text-amber-900' : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'}`}
                            onClick={() => setType('note')}
                        >
                            <span className="inline-flex items-center justify-center gap-2">
                                <NotebookPen className="h-4 w-4" />
                                {tm('noteRequest')}
                            </span>
                        </button>
                    </div>

                    <div className="rounded-2xl border border-ink/10 bg-white/70 p-4">
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
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={formData.leaveType || 'ANNUAL'}
                                        onChange={(e) => update('leaveType', e.target.value)}
                                    >
                                        <option value="ANNUAL">{tm('leaveAnnual')}</option>
                                        <option value="CASUAL">{tm('leaveCasual')}</option>
                                    </select>
                                </label>
                                <label className="text-sm">
                                    {tm('startDate')}
                                    <input
                                        type="date"
                                        defaultValue={dateValue}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => update('startDate', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {tm('endDate')}
                                    <input
                                        type="date"
                                        defaultValue={dateValue}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => update('endDate', e.target.value)}
                                    />
                                </label>
                            </div>
                            <label className="text-sm">
                                {tm('reason')}
                                <textarea
                                    rows={3}
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    onChange={(e) => update('reason', e.target.value)}
                                />
                            </label>
                        </>
                    )}

                    {type === 'absence' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {tm('startDate')}
                                    <input
                                        type="date"
                                        defaultValue={dateValue}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => update('startDate', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {tm('endDate')}
                                    <input
                                        type="date"
                                        defaultValue={dateValue}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => update('endDate', e.target.value)}
                                    />
                                </label>
                            </div>
                            <label className="text-sm">
                                {tm('reason')}
                                <textarea
                                    rows={3}
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    onChange={(e) => update('reason', e.target.value)}
                                />
                            </label>
                        </>
                    )}

                    {type === 'permission' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {tm('permissionScope')}
                                    <select
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
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
                                            className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                            placeholder={tm('durationHours')}
                                            value={formData.durationHours || ''}
                                            onChange={(e) => update('durationHours', e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            min={0}
                                            max={59}
                                            className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
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

                    {type === 'mission' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    {tm('missionType')}
                                    <select
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        value={formData.missionType || 'ALL_DAY'}
                                        onChange={(e) => update('missionType', e.target.value)}
                                    >
                                        {missionTypeOptions.map((opt) => (
                                            <option key={opt} value={opt}>{tm(`missionType_${opt}`)}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="text-sm">
                                    {tm('startDate')}
                                    <input
                                        type="date"
                                        defaultValue={dateValue}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => update('startDate', e.target.value)}
                                    />
                                </label>
                                <label className="text-sm">
                                    {tm('endDate')}
                                    <input
                                        type="date"
                                        defaultValue={dateValue}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => update('endDate', e.target.value)}
                                    />
                                </label>
                            </div>
                            <label className="text-sm">
                                {tm('missionTo')}
                                <textarea
                                    rows={2}
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    onChange={(e) => update('missionTo', e.target.value)}
                                />
                            </label>
                            <label className="text-sm">
                                {tm('missionPurpose')}
                                <textarea
                                    rows={3}
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
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
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    placeholder={tm('noteTitlePlaceholder')}
                                    value={formData.noteTitle || ''}
                                    onChange={(e) => update('noteTitle', e.target.value)}
                                />
                            </label>
                            <label className="text-sm">
                                {tm('noteBody')}
                                <textarea
                                    rows={4}
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
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
                    <button className="btn-primary" onClick={submit} disabled={loading || !type}>
                        {loading ? tm('saving') : tm('submit')}
                    </button>
                </div>
            </div>
        </div>
    );
}


