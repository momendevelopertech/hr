'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import api, { clearApiCache } from '@/lib/api';
import { enumLabels } from '@/lib/enum-labels';
import { formatPermissionDuration } from '@/lib/permission-duration';
import type { CalendarEvent } from './CalendarView';

type Props = {
    open: boolean;
    event: CalendarEvent | null;
    locale: 'en' | 'ar';
    currentUserId?: string | null;
    onClose: () => void;
    onMutate?: () => void;
};

export default function EventDetailsModal({ open, event, locale, currentUserId, onClose, onMutate }: Props) {
    const t = useTranslations('eventDetails');
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editNote, setEditNote] = useState(false);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteBody, setNoteBody] = useState('');
    const [editLate, setEditLate] = useState(false);
    const [lateMinutes, setLateMinutes] = useState('');

    if (!open || !event) return null;

    const resource = event.resource || {};
    const item = resource.item || {};
    const kind = resource.kind as string | undefined;

    const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US';
    const formattedDate = (() => {
        if (event.start && event.end && event.start.toDateString() !== event.end.toDateString()) {
            return `${event.start.toLocaleDateString(dateLocale)} - ${event.end.toLocaleDateString(dateLocale)}`;
        }
        return event.start ? event.start.toLocaleDateString(dateLocale) : '-';
    })();

    const employeeName = item.user?.fullName || item.fullName || t('notAvailable');
    const statusLabel = item.status
        ? enumLabels.status(item.status, locale, {
            requestType: kind === 'permission' ? 'permission' : kind === 'leave' || kind === 'absence' || kind === 'mission' ? 'leave' : undefined,
            approvedByMgrId: item.approvedByMgrId ?? null,
            approvedByHrId: item.approvedByHrId ?? null,
        })
        : '-';
    const reason = item.reason || item.body || item.note || '';

    const typeLabel = (() => {
        if (kind === 'permission') {
            return enumLabels.permissionType(item.permissionType || resource.type || '', locale);
        }
        if (kind === 'leave') {
            return enumLabels.leaveType(item.leaveType || resource.type || '', locale);
        }
        if (kind === 'mission') {
            return enumLabels.leaveType('MISSION', locale);
        }
        if (kind === 'absence') {
            return enumLabels.leaveType('ABSENCE_WITH_PERMISSION', locale);
        }
        if (kind === 'form') {
            return locale === 'ar' ? item.form?.nameAr || item.form?.name || t('form') : item.form?.name || t('form');
        }
        if (kind === 'note') {
            return t('note');
        }
        return event.title || '-';
    })();

    const ownerId = item.userId || item.user?.id;
    const canManage = !!currentUserId && ownerId === currentUserId && (kind === 'note' || kind === 'lateness');

    const startEditNote = () => {
        setNoteTitle(item.title || '');
        setNoteBody(item.body || '');
        setEditNote(true);
    };

    const startEditLate = () => {
        setLateMinutes(String(item.minutesLate ?? ''));
        setEditLate(true);
    };

    const saveNote = async () => {
        if (!item.id) return;
        setSaving(true);
        try {
            await api.patch(`/notes/${item.id}`, { title: noteTitle.trim() || 'Note', body: noteBody });
            clearApiCache();
            onMutate?.();
            toast.success(locale === 'ar' ? 'تم الحفظ' : 'Saved');
            setEditNote(false);
            onClose();
        } catch (e: any) {
            toast.error(e?.message || (locale === 'ar' ? 'تعذر الحفظ' : 'Save failed'));
        } finally {
            setSaving(false);
        }
    };

    const deleteNote = async () => {
        if (!item.id) return;
        if (!window.confirm(locale === 'ar' ? 'حذف الملاحظة؟' : 'Delete this note?')) return;
        setDeleting(true);
        try {
            await api.delete(`/notes/${item.id}`);
            clearApiCache();
            onMutate?.();
            toast.success(locale === 'ar' ? 'تم الحذف' : 'Deleted');
            onClose();
        } catch (e: any) {
            toast.error(e?.message || (locale === 'ar' ? 'تعذر الحذف' : 'Delete failed'));
        } finally {
            setDeleting(false);
        }
    };

    const saveLate = async () => {
        if (!item.id) return;
        const minutes = Math.max(0, Math.round(Number(lateMinutes)));
        if (!minutes) {
            toast.error(locale === 'ar' ? 'أدخل دقائق صحيحة' : 'Enter valid minutes');
            return;
        }
        setSaving(true);
        try {
            const ymd = event.start ? `${event.start.getFullYear()}-${String(event.start.getMonth() + 1).padStart(2, '0')}-${String(event.start.getDate()).padStart(2, '0')}` : '';
            await api.post('/lateness', { date: ymd, minutesLate: minutes });
            clearApiCache();
            onMutate?.();
            toast.success(locale === 'ar' ? 'تم الحفظ' : 'Saved');
            setEditLate(false);
            onClose();
        } catch (e: any) {
            toast.error(e?.message || (locale === 'ar' ? 'تعذر الحفظ' : 'Save failed'));
        } finally {
            setSaving(false);
        }
    };

    const deleteLate = async () => {
        if (!item.id) return;
        if (!window.confirm(locale === 'ar' ? 'حذف تسجيل التأخير؟' : 'Delete this lateness entry?')) return;
        setDeleting(true);
        try {
            await api.delete(`/lateness/${item.id}`);
            clearApiCache();
            onMutate?.();
            toast.success(locale === 'ar' ? 'تم الحذف' : 'Deleted');
            onClose();
        } catch (e: any) {
            toast.error(e?.message || (locale === 'ar' ? 'تعذر الحذف' : 'Delete failed'));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="card w-full max-w-2xl p-6">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">{t('title')}</h3>
                    <button className="btn-outline" onClick={onClose}>{t('close')}</button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('employee')}</p>
                        <p className="font-semibold">{employeeName}</p>
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('type')}</p>
                        <p className="font-semibold">{typeLabel}</p>
                    </div>
                    {item.status && (
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('status')}</p>
                            <p className="font-semibold">{statusLabel}</p>
                        </div>
                    )}
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('date')}</p>
                        <p className="font-semibold">{formattedDate}</p>
                    </div>
                    {kind === 'permission' && (
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('duration')}</p>
                            <p className="font-semibold">{formatPermissionDuration(Number(item.hoursUsed ?? 0), locale)}</p>
                        </div>
                    )}
                    {kind === 'note' && !editNote && (
                        <div className="md:col-span-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('noteTitle')}</p>
                            <p className="font-semibold">{item.title || t('notAvailable')}</p>
                        </div>
                    )}
                </div>

                {kind === 'note' && editNote && canManage && (
                    <div className="mt-4 space-y-3">
                        <label className="block text-sm">
                            {t('noteTitle')}
                            <input className="field mt-1 w-full px-3 py-2" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
                        </label>
                        <label className="block text-sm">
                            {t('details')}
                            <textarea className="field mt-1 min-h-[100px] w-full px-3 py-2" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button className="btn-primary" type="button" disabled={saving} onClick={saveNote}>{t('save')}</button>
                            <button className="btn-outline" type="button" onClick={() => setEditNote(false)}>{t('cancel')}</button>
                        </div>
                    </div>
                )}

                {kind === 'lateness' && editLate && canManage && (
                    <div className="mt-4 space-y-3">
                        <label className="block text-sm">
                            {t('lateMinutes')}
                            <input type="number" min={1} className="field mt-1 w-full px-3 py-2" value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)} />
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button className="btn-primary" type="button" disabled={saving} onClick={saveLate}>{t('save')}</button>
                            <button className="btn-outline" type="button" onClick={() => setEditLate(false)}>{t('cancel')}</button>
                        </div>
                    </div>
                )}

                {reason && !editNote && (
                    <div className="mt-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('details')}</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{reason}</p>
                    </div>
                )}

                {canManage && kind === 'note' && !editNote && (
                    <div className="mt-6 flex flex-wrap gap-2">
                        <button className="btn-outline" type="button" onClick={startEditNote}>{t('edit')}</button>
                        <button className="btn-outline border-rose-200 text-rose-700" type="button" disabled={deleting} onClick={deleteNote}>{t('delete')}</button>
                    </div>
                )}

                {canManage && kind === 'lateness' && !editLate && (
                    <div className="mt-6 flex flex-wrap gap-2">
                        <button className="btn-outline" type="button" onClick={startEditLate}>{t('edit')}</button>
                        <button className="btn-outline border-rose-200 text-rose-700" type="button" disabled={deleting} onClick={deleteLate}>{t('delete')}</button>
                    </div>
                )}
            </div>
        </div>
    );
}
