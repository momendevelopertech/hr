'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { enumLabels } from '@/lib/enum-labels';
import type { CalendarEvent } from './CalendarView';

type Props = {
    open: boolean;
    event: CalendarEvent | null;
    locale: 'en' | 'ar';
    onClose: () => void;
};

export default function EventDetailsModal({ open, event, locale, onClose }: Props) {
    const t = useTranslations('eventDetails');

    if (!open || !event) return null;

    const resource = event.resource || {};
    const item = resource.item || {};
    const kind = resource.kind as string | undefined;

    const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US';
    const formattedDate = useMemo(() => {
        if (event.start && event.end && event.start.toDateString() !== event.end.toDateString()) {
            return `${event.start.toLocaleDateString(dateLocale)} - ${event.end.toLocaleDateString(dateLocale)}`;
        }
        return event.start ? event.start.toLocaleDateString(dateLocale) : '-';
    }, [dateLocale, event.end, event.start]);

    const employeeName = item.user?.fullName || item.fullName || t('notAvailable');
    const statusLabel = item.status ? enumLabels.status(item.status, locale) : '-';
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
                            <p className="font-semibold">{item.hoursUsed ?? 0}h</p>
                        </div>
                    )}
                    {kind === 'note' && (
                        <div className="md:col-span-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('noteTitle')}</p>
                            <p className="font-semibold">{item.title || t('notAvailable')}</p>
                        </div>
                    )}
                </div>

                {reason && (
                    <div className="mt-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('details')}</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{reason}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
