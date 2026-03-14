'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';

type DateRangeFilterProps = {
    locale: string;
    from?: string;
    to?: string;
    onChange: (next: { from: string; to: string }) => void;
    className?: string;
};

const toYmd = (value: Date) => format(value, 'yyyy-MM-dd');

export default function DateRangeFilter({ locale, from = '', to = '', onChange, className = '' }: DateRangeFilterProps) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'single' | 'range'>(from && to && from === to ? 'single' : 'range');
    const rootRef = useRef<HTMLDivElement | null>(null);
    const panelId = useId();

    useEffect(() => {
        if (from && to && from === to) {
            setMode('single');
            return;
        }
        setMode('range');
    }, [from, to]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEsc);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [open]);

    const label = useMemo(() => {
        const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US';
        const formatText = (value: string) => new Date(value).toLocaleDateString(dateLocale);

        if (from && to && from === to) return formatText(from);
        if (from && to) return `${formatText(from)} - ${formatText(to)}`;
        if (from) return formatText(from);
        return locale === 'ar' ? 'اختر التاريخ / الفترة' : 'Select date / range';
    }, [from, locale, to]);

    const applyToday = () => {
        const today = toYmd(new Date());
        onChange({ from: today, to: today });
        setMode('single');
    };

    const applyLast7Days = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 6);
        onChange({ from: toYmd(start), to: toYmd(end) });
        setMode('range');
    };

    const clear = () => onChange({ from: '', to: '' });

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-start"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-controls={panelId}
            >
                {label}
            </button>

            {open && (
                <div id={panelId} className="absolute z-30 mt-2 w-full min-w-[280px] max-w-[min(92vw,420px)] rounded-2xl border border-ink/10 bg-white p-3 shadow-lg">
                    <div className="mb-3 flex items-center gap-2">
                        <button
                            type="button"
                            className={`rounded-lg border px-3 py-1 text-sm ${mode === 'single' ? 'border-ink/40 bg-ink/10' : 'border-ink/15'}`}
                            onClick={() => {
                                setMode('single');
                                if (from && to && from !== to) onChange({ from, to: from });
                            }}
                        >
                            {locale === 'ar' ? 'يوم واحد' : 'Single day'}
                        </button>
                        <button
                            type="button"
                            className={`rounded-lg border px-3 py-1 text-sm ${mode === 'range' ? 'border-ink/40 bg-ink/10' : 'border-ink/15'}`}
                            onClick={() => setMode('range')}
                        >
                            {locale === 'ar' ? 'فترة زمنية' : 'Date range'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        <input
                            type="date"
                            className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={from}
                            onChange={(e) => {
                                const nextFrom = e.target.value;
                                if (mode === 'single') {
                                    onChange({ from: nextFrom, to: nextFrom });
                                    return;
                                }
                                const nextTo = !to || (nextFrom && to < nextFrom) ? nextFrom : to;
                                onChange({ from: nextFrom, to: nextTo });
                            }}
                        />
                        {mode === 'range' && (
                            <input
                                type="date"
                                className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                value={to}
                                min={from || undefined}
                                onChange={(e) => {
                                    const nextTo = e.target.value;
                                    if (from && nextTo && nextTo < from) {
                                        onChange({ from, to: from });
                                        return;
                                    }
                                    onChange({ from, to: nextTo });
                                }}
                            />
                        )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="btn-outline text-xs" onClick={applyToday}>
                            {locale === 'ar' ? 'اليوم' : 'Today'}
                        </button>
                        <button type="button" className="btn-outline text-xs" onClick={applyLast7Days}>
                            {locale === 'ar' ? 'آخر 7 أيام' : 'Last 7 days'}
                        </button>
                        <button type="button" className="btn-outline text-xs" onClick={clear}>
                            {locale === 'ar' ? 'مسح' : 'Clear'}
                        </button>
                        <button type="button" className="btn-outline text-xs" onClick={() => setOpen(false)}>
                            {locale === 'ar' ? 'إغلاق' : 'Done'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
