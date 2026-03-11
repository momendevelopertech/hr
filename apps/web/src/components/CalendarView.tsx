'use client';

import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isSameDay, addMonths, addWeeks, addDays, endOfWeek } from 'date-fns';
import { enUS, arSA } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

const locales = {
    en: enUS,
    ar: arSA,
};

export type CalendarEvent = {
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: any;
};

type WorkSchedule = {
    activeMode: 'NORMAL' | 'RAMADAN';
    ramadanStartDate: string | null;
    ramadanEndDate: string | null;
};

const parseDateOnly = (value?: string | null) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

const dateOnly = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export default function CalendarView({
    locale,
    events,
    onSelectSlot,
    onSelectEvent,
    schedule,
}: {
    locale: 'en' | 'ar';
    events: CalendarEvent[];
    onSelectSlot: (date: Date) => void;
    onSelectEvent?: (event: CalendarEvent) => void;
    schedule?: WorkSchedule | null;
}) {
    const t = useTranslations('calendar');
    const localizer = useMemo(
        () =>
            dateFnsLocalizer({
                format,
                parse,
                startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 6 }),
                getDay,
                locales,
            }),
        [],
    );

    const [view, setView] = useState<View>('month');
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const weekdayFormat = (date: Date) =>
        format(date, locale === 'ar' ? 'EEEE' : 'EEEE', { locale: locale === 'ar' ? arSA : enUS });

    const eventPropGetter = (event: CalendarEvent) => {
        const key = event.resource?.key;
        const base = { className: 'rbc-event-clickable' };
        if (key === 'leave') return { ...base, style: { backgroundColor: '#2f6b5f', borderColor: '#2f6b5f' } };
        if (key === 'absence') return { ...base, style: { backgroundColor: '#b45309', borderColor: '#b45309' } };
        if (key === 'mission') return { ...base, style: { backgroundColor: '#0f766e', borderColor: '#0f766e' } };
        if (key === 'personal') return { ...base, style: { backgroundColor: '#1f3a52', borderColor: '#1f3a52' } };
        if (key === 'form') return { ...base, style: { backgroundColor: '#6b7280', borderColor: '#6b7280' } };
        if (key === 'note') return { ...base, style: { backgroundColor: '#a16207', borderColor: '#a16207' } };
        return { ...base, style: { backgroundColor: '#475569', borderColor: '#475569' } };
    };

    const title = useMemo(() => {
        const dateLocale = locale === 'ar' ? arSA : enUS;
        if (view === 'month') {
            return format(currentDate, 'MMMM yyyy', { locale: dateLocale });
        }
        if (view === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 6 });
            const end = endOfWeek(currentDate, { weekStartsOn: 6 });
            return `${format(start, 'd MMM', { locale: dateLocale })} - ${format(end, 'd MMM yyyy', { locale: dateLocale })}`;
        }
        return format(currentDate, 'PPPP', { locale: dateLocale });
    }, [currentDate, locale, view]);

    const navigate = (direction: 'prev' | 'next') => {
        const multiplier = direction === 'next' ? 1 : -1;
        if (view === 'month') {
            setCurrentDate((prev) => addMonths(prev, multiplier));
            return;
        }
        if (view === 'week') {
            setCurrentDate((prev) => addWeeks(prev, multiplier));
            return;
        }
        setCurrentDate((prev) => addDays(prev, multiplier));
    };

    const ramadanRange = useMemo(() => {
        if (!schedule || schedule.activeMode !== 'RAMADAN') return null;
        const start = parseDateOnly(schedule.ramadanStartDate);
        const end = parseDateOnly(schedule.ramadanEndDate);
        if (!start || !end) return null;
        return { start, end };
    }, [schedule]);

    return (
        <div className="card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('title')}</p>
                    <p className="text-lg font-semibold text-ink">{t('createRequest')}</p>
                    <p className="text-sm text-ink/70">{title}</p>
                    {ramadanRange && (
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900">
                            <span>{t('ramadanBadge')}</span>
                            <span className="text-amber-800">
                                {format(ramadanRange.start, 'd MMM yyyy', { locale: locale === 'ar' ? arSA : enUS })} -{' '}
                                {format(ramadanRange.end, 'd MMM yyyy', { locale: locale === 'ar' ? arSA : enUS })}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button className="btn-outline" onClick={() => navigate('prev')}>
                        {t('previous')}
                    </button>
                    <button className="btn-outline" onClick={() => navigate('next')}>
                        {t('next')}
                    </button>
                    <button className={`btn-outline ${view === 'month' ? 'bg-ink/10' : ''}`} onClick={() => setView('month')}>
                        {t('month')}
                    </button>
                    <button className={`btn-outline ${view === 'week' ? 'bg-ink/10' : ''}`} onClick={() => setView('week')}>
                        {t('week')}
                    </button>
                    <button className={`btn-outline ${view === 'day' ? 'bg-ink/10' : ''}`} onClick={() => setView('day')}>
                        {t('day')}
                    </button>
                </div>
            </div>
            <Calendar
                localizer={localizer}
                culture={locale}
                rtl={locale === 'ar'}
                events={events}
                view={view}
                views={['month', 'week', 'day']}
                toolbar={false}
                date={currentDate}
                onNavigate={(date) => setCurrentDate(date)}
                onView={setView}
                selectable
                onSelectSlot={(slot) => {
                    const selected = slot.start as Date;
                    if (selected.getDay() === 5) return;
                    onSelectSlot(selected);
                }}
                onSelectEvent={(event) => {
                    const selected = event.start as Date;
                    if (selected.getDay() === 5) return;
                    if (onSelectEvent) {
                        onSelectEvent(event);
                        return;
                    }
                    onSelectSlot(selected);
                }}
                startAccessor="start"
                endAccessor="end"
                eventPropGetter={eventPropGetter}
                formats={{ weekdayFormat }}
                style={{ height: 520 }}
                dayPropGetter={(date) => {
                    const isRamadan =
                        !!ramadanRange &&
                        dateOnly(date) >= ramadanRange.start &&
                        dateOnly(date) <= ramadanRange.end;
                    if (date.getDay() === 5) {
                        return { className: 'rbc-day-disabled', style: { backgroundColor: '#e5e7eb', color: '#6b7280' } };
                    }
                    if (isSameDay(date, new Date())) {
                        return {
                            className: 'rbc-day-clickable',
                            style: { backgroundColor: isRamadan ? '#fde68a' : '#fef3c7' },
                        };
                    }
                    if (isRamadan) {
                        return { className: 'rbc-day-clickable', style: { backgroundColor: '#fef9c3' } };
                    }
                    return { className: 'rbc-day-clickable', style: { backgroundColor: 'rgba(255,255,255,0.6)' } };
                }}
            />
        </div>
    );
}
