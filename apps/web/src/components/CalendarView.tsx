'use client';

import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS, arSA } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

const locales = {
    en: enUS,
    ar: arSA,
};

type CalendarEvent = {
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: any;
};

export default function CalendarView({
    locale,
    events,
    onSelectSlot,
}: {
    locale: 'en' | 'ar';
    events: CalendarEvent[];
    onSelectSlot: (date: Date) => void;
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

    return (
        <div className="card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{t('title')}</p>
                    <p className="text-lg font-semibold text-ink">{t('createRequest')}</p>
                </div>
                <div className="flex gap-2">
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
                events={events}
                view={view}
                onView={setView}
                selectable
                onSelectSlot={(slot) => onSelectSlot(slot.start as Date)}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 520 }}
                dayPropGetter={() => ({ style: { backgroundColor: 'rgba(255,255,255,0.6)' } })}
            />
        </div>
    );
}
