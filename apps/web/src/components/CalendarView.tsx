'use client';

import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isSameDay, addMonths, addWeeks, addDays, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { enUS, arSA } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Day } from 'date-fns';
import HintBar from './HintBar';
import SpotlightGuide from './SpotlightGuide';
import SmartAttendanceCard, { type SmartAttendanceData } from './calendar/SmartAttendanceCard';
import { getCompanyOffDayInfo, getCompanyOffDayKind, getCompanyOffDayLabel, isCompanyOffDay, type CalendarOffDayRule } from './calendar/companyOffDays';

const locales = {
    en: enUS,
    ar: arSA,
};

const CALENDAR_WEEK_STARTS_ON: Day = 6;

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
    calendarOffDays?: CalendarOffDayRule[] | null;
};

const parseDateOnly = (value?: string | null) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

const dateOnly = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const stableCalendarDate = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
const buildStableDayRange = (start: Date, end: Date) =>
    eachDayOfInterval({
        start: dateOnly(start),
        end: dateOnly(end),
    }).map(stableCalendarDate);

const calendarEventToneClass: Record<string, string> = {
    leave: 'calendar-event-tone-leave',
    absence: 'calendar-event-tone-absence',
    mission: 'calendar-event-tone-mission',
    personal: 'calendar-event-tone-personal',
    form: 'calendar-event-tone-form',
    note: 'calendar-event-tone-note',
    lateness: 'calendar-event-tone-lateness',
};

export default function CalendarView({
    locale,
    events,
    attendanceData,
    onSelectSlot,
    onSelectEvent,
    schedule,
}: {
    locale: 'en' | 'ar';
    events: CalendarEvent[];
    attendanceData: SmartAttendanceData;
    onSelectSlot: (date: Date) => void;
    onSelectEvent?: (event: CalendarEvent) => void;
    schedule?: WorkSchedule | null;
}) {
    const t = useTranslations('calendar');
    const tDashboard = useTranslations('dashboard');
    const tRequestModal = useTranslations('requestModal');
    const localizer = useMemo(
        () => {
            const baseLocalizer = dateFnsLocalizer({
                format,
                parse,
                startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: CALENDAR_WEEK_STARTS_ON }),
                getDay,
                locales,
            });

            const getWeekStartsOn = (currentLocalizer?: { startOfWeek?: () => number }): Day =>
                typeof currentLocalizer?.startOfWeek === 'function'
                    ? (currentLocalizer.startOfWeek() as Day)
                    : CALENDAR_WEEK_STARTS_ON;

            baseLocalizer.firstVisibleDay = (date: Date, currentLocalizer?: { startOfWeek?: () => number }) =>
                stableCalendarDate(startOfWeek(startOfMonth(date), { weekStartsOn: getWeekStartsOn(currentLocalizer) }));

            baseLocalizer.lastVisibleDay = (date: Date, currentLocalizer?: { startOfWeek?: () => number }) =>
                stableCalendarDate(endOfWeek(endOfMonth(date), { weekStartsOn: getWeekStartsOn(currentLocalizer) }));

            baseLocalizer.visibleDays = (date: Date, currentLocalizer?: { startOfWeek?: () => number }) =>
                buildStableDayRange(
                    baseLocalizer.firstVisibleDay(date, currentLocalizer),
                    baseLocalizer.lastVisibleDay(date, currentLocalizer),
                );

            const originalRange = baseLocalizer.range.bind(baseLocalizer);
            baseLocalizer.range = (start: Date, end: Date, unit = 'day') => {
                if (unit === 'day') {
                    return buildStableDayRange(start, end);
                }

                return originalRange(start, end, unit);
            };

            return baseLocalizer;
        },
        [],
    );

    const [view, setView] = useState<View>('month');
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [viewportWidth, setViewportWidth] = useState(1200);
    const [mobileSelectedDate, setMobileSelectedDate] = useState<Date>(dateOnly(new Date()));
    const [guideOpen, setGuideOpen] = useState(false);
    const [currentGuideStep, setCurrentGuideStep] = useState(0);
    const calendarLocale = locale === 'ar' ? arSA : enUS;
    const PrevIcon = locale === 'ar' ? ChevronRight : ChevronLeft;
    const NextIcon = locale === 'ar' ? ChevronLeft : ChevronRight;
    const fullWeekdayFormat = (date: Date) => format(date, 'EEEE', { locale: calendarLocale });
    const calendarGridRef = useRef<HTMLDivElement | null>(null);
    const hoveredCellRef = useRef<HTMLElement | null>(null);
    const createRequestRef = useRef<HTMLButtonElement | null>(null);
    const didAutoSwitchRef = useRef(false);

    const DateCellWrapper = useCallback(({ value, children }: { value: Date; children: ReactElement }) => {
        if (!isValidElement(children)) return children;
        const offDayLabel = getCompanyOffDayLabel(value, locale, schedule?.calendarOffDays);
        const extra = {
            'data-date': format(value, 'yyyy-MM-dd'),
            'data-day': value.getDate(),
            ...(offDayLabel ? { 'data-off-label': offDayLabel } : {}),
        } as Record<string, string | number>;
        return cloneElement(children as ReactElement<any>, extra);
    }, [locale, schedule?.calendarOffDays]);

    const CalendarDateHeader = useCallback(({ date }: { date: Date }) => {
        const offDayInfo = getCompanyOffDayInfo(date, locale, schedule?.calendarOffDays);
        return (
            <span className="calendar-date-header">
                <span className="calendar-date-number" data-day-number={date.getDate()}>
                    {date.getDate()}
                </span>
                {offDayInfo ? (
                    <span className={`calendar-date-badge calendar-date-badge-${offDayInfo.kind}`}>
                        {offDayInfo.label}
                    </span>
                ) : null}
            </span>
        );
    }, [locale, schedule?.calendarOffDays]);

    const clearHoveredCell = useCallback(() => {
        if (!hoveredCellRef.current) return;
        hoveredCellRef.current.classList.remove('rbc-cell-hover');
        hoveredCellRef.current = null;
    }, []);

    const findMonthCellFromPoint = useCallback((x: number, y: number) => {
        if (view !== 'month') return null;
        const elements = document.elementsFromPoint(x, y) as HTMLElement[];
        const match = elements.find((el) => el.classList?.contains('rbc-day-bg'));
        if (!match) return null;
        if (!calendarGridRef.current?.contains(match)) return null;
        if (match.classList.contains('rbc-day-disabled')) return null;
        return match;
    }, [view]);

    const handleGridMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
        if (guideOpen) return;
        const cell = findMonthCellFromPoint(event.clientX, event.clientY);
        if (!cell) {
            clearHoveredCell();
            return;
        }
        if (hoveredCellRef.current === cell) return;
        clearHoveredCell();
        cell.classList.add('rbc-cell-hover');
        hoveredCellRef.current = cell;
    }, [clearHoveredCell, findMonthCellFromPoint, guideOpen]);

    const handleGridMouseLeave = useCallback(() => {
        clearHoveredCell();
    }, [clearHoveredCell]);

    const spawnRipple = useCallback((cell: HTMLElement, x: number, y: number) => {
        const rect = cell.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const ripple = document.createElement('div');
        ripple.className = 'calendar-cell-ripple';
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${x - rect.left - size / 2}px`;
        ripple.style.top = `${y - rect.top - size / 2}px`;
        cell.appendChild(ripple);
        window.setTimeout(() => ripple.remove(), 500);
    }, []);

    const handleGridClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
        if (guideOpen) return;
        const cell = findMonthCellFromPoint(event.clientX, event.clientY);
        if (!cell) return;
        spawnRipple(cell, event.clientX, event.clientY);
    }, [findMonthCellFromPoint, guideOpen, spawnRipple]);

    const eventPropGetter = (event: CalendarEvent) => {
        const key = event.resource?.key;
        const offDay = isCompanyOffDay(event.start, schedule?.calendarOffDays);
        return {
            className: `rbc-event-clickable ${calendarEventToneClass[key || ''] || 'calendar-event-tone-default'}${offDay ? ' rbc-event-disabled' : ''}`,
            ...(offDay ? { style: { pointerEvents: 'none' as const, opacity: 0.55 } } : {}),
        };
    };

    const title = useMemo(() => {
        if (view === 'month') {
            return format(currentDate, 'MMMM yyyy', { locale: calendarLocale });
        }
        if (view === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 6 });
            const end = endOfWeek(currentDate, { weekStartsOn: 6 });
            return `${format(start, 'd MMM', { locale: calendarLocale })} - ${format(end, 'd MMM yyyy', { locale: calendarLocale })}`;
        }
        return format(currentDate, 'PPPP', { locale: calendarLocale });
    }, [calendarLocale, currentDate, view]);

    const handleSelectDate = useCallback((selected: Date) => {
        if (isCompanyOffDay(selected, schedule?.calendarOffDays)) return;
        onSelectSlot(selected);
    }, [onSelectSlot, schedule?.calendarOffDays]);

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

    useEffect(() => {
        const check = () => setViewportWidth(window.innerWidth);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    useEffect(() => {
        if (viewportWidth >= 768) return;
        if (didAutoSwitchRef.current) return;
        setView('week');
        didAutoSwitchRef.current = true;
    }, [viewportWidth]);

    useEffect(() => {
        clearHoveredCell();
    }, [clearHoveredCell, view]);

    useEffect(() => {
        if (guideOpen) {
            clearHoveredCell();
        }
    }, [clearHoveredCell, guideOpen]);

    const guideEventDate = useMemo(() => {
        const match = events.find((event) =>
            event.start &&
            event.start.getMonth() === currentDate.getMonth() &&
            event.start.getFullYear() === currentDate.getFullYear(),
        );
        if (!match) return null;
        return format(dateOnly(match.start), 'yyyy-MM-dd');
    }, [currentDate, events]);

    const mobileStripDates = useMemo(() => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 6 });
        return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    }, [currentDate]);

    const mobileEvents = useMemo(() => {
        if (!(view === 'week' || view === 'day')) return [];
        return events.filter((event) => isSameDay(event.start, mobileSelectedDate));
    }, [events, mobileSelectedDate, view]);

    const mobileStats = useMemo(() => {
        const lateCount = mobileEvents.filter((event) => event.resource?.key === 'lateness').length;
        const absentCount = mobileEvents.filter((event) => event.resource?.key === 'absence').length;
        const attendanceCount = mobileEvents.length - lateCount - absentCount;
        return { attendanceCount, lateCount, absentCount };
    }, [mobileEvents]);

    useEffect(() => {
        setMobileSelectedDate(dateOnly(currentDate));
    }, [currentDate, view]);

    const guideSteps = useMemo(() => {
        const dayTenSelector = '.rbc-month-view .rbc-day-bg[data-day="10"]:not(.rbc-off-range-bg)';
        const eventSelector = guideEventDate
            ? `.rbc-month-view .rbc-day-bg[data-date="${guideEventDate}"]`
            : dayTenSelector;
        return [
            {
                titleAr: 'اضغط على اليوم',
                descAr: 'اضغط على أي خلية في التقويم لإضافة حدث أو مأمورية في ذلك اليوم.',
                targetSelector: dayTenSelector,
                tooltipPos: 'below' as const,
            },
            {
                titleAr: 'شوف المواعيد الموجودة',
                descAr: 'الأحداث المجدولة بتظهر كشريط ملون جوه الخلية. اضغط عليها للتفاصيل.',
                targetSelector: eventSelector,
                tooltipPos: 'below' as const,
            },
            {
                titleAr: 'زر "إنشاء طلب"',
                descAr: 'ممكن كمان تضغط على "إنشاء طلب" في الأعلى لإضافة حدث من غير ما تختار يوم الأول.',
                targetRef: createRequestRef,
                tooltipPos: 'below' as const,
            },
        ];
    }, [guideEventDate]);

    return (
        <div className="card calendar-shell p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-[clamp(11px,0.9vw,14px)] uppercase tracking-[0.2em] text-ink/50">{t('title')}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            ref={createRequestRef}
                            className="btn-primary text-[clamp(14px,1.2vw,18px)]"
                            onClick={() => {
                                handleSelectDate(new Date());
                            }}
                        >
                            {t('createRequest')}
                        </button>
                        <button
                            className="btn-outline text-[clamp(11px,0.9vw,14px)]"
                            onClick={() => {
                                setView('month');
                                setGuideOpen(true);
                                setCurrentGuideStep(0);
                            }}
                        >
                            جولة تعريفية
                        </button>
                    </div>
                    <p className="calendar-current-range">{title}</p>
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
                <div className="calendar-controls flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="calendar-pill-group inline-flex items-center p-1 shadow-sm">
                        <button className="calendar-pill-btn btn-outline border-0 bg-transparent px-3 py-1.5 text-[clamp(11px,0.9vw,14px)]" onClick={() => navigate('prev')}>
                            <PrevIcon className="size-4" aria-hidden="true" />
                            <span>{t('previous')}</span>
                        </button>
                        <button className="calendar-pill-btn btn-outline border-0 bg-transparent px-3 py-1.5 text-[clamp(11px,0.9vw,14px)]" onClick={() => navigate('next')}>
                            <span>{t('next')}</span>
                            <NextIcon className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="calendar-pill-group inline-flex items-center p-1 shadow-sm">
                        <button
                            className={`calendar-pill-btn btn-outline border-0 px-3 py-1.5 text-[clamp(11px,0.9vw,14px)] ${view === 'month' ? 'is-active' : 'bg-transparent'}`}
                            onClick={() => setView('month')}
                        >
                            {t('month')}
                        </button>
                        <button
                            className={`calendar-pill-btn btn-outline border-0 px-3 py-1.5 text-[clamp(11px,0.9vw,14px)] ${view === 'week' ? 'is-active' : 'bg-transparent'}`}
                            onClick={() => setView('week')}
                        >
                            {t('week')}
                        </button>
                        <button
                            className={`calendar-pill-btn btn-outline border-0 px-3 py-1.5 text-[clamp(11px,0.9vw,14px)] ${view === 'day' ? 'is-active' : 'bg-transparent'}`}
                            onClick={() => setView('day')}
                        >
                            {t('day')}
                        </button>
                    </div>
                </div>
            </div>
            <HintBar message="💡 اضغط على أي خلية في التقويم لإضافة حدث جديد" />
            {viewportWidth >= 768 && viewportWidth < 1024 && (
                <SmartAttendanceCard variant="bar" data={attendanceData} className="mb-3" />
            )}
            {(view === 'week' || view === 'day') ? (
                <div className="calendar-mobile-view calendar-focus-view">
                    <div className="day-strip" role="tablist" aria-label={title}>
                        {mobileStripDates.map((date) => {
                            const isActive = isSameDay(date, mobileSelectedDate);
                            const isToday = isSameDay(date, new Date());
                            const hasEvents = events.some((event) => isSameDay(event.start, date));
                            const offDayLabel = getCompanyOffDayLabel(date, locale, schedule?.calendarOffDays);
                            const isOffDay = Boolean(offDayLabel);
                            return (
                                <button
                                    key={date.toISOString()}
                                    type="button"
                                    className={`day-pill${isActive ? ' is-active' : ''}${isToday ? ' today' : ''}${isOffDay ? ' is-friday' : ''}`}
                                    onClick={() => {
                                        if (isOffDay) return;
                                        setMobileSelectedDate(date);
                                    }}
                                    disabled={isOffDay}
                                >
                                    <span className="day-pill-name">{format(date, 'EEE', { locale: calendarLocale })}</span>
                                    <span className="day-pill-date">{format(date, 'd', { locale: calendarLocale })}</span>
                                    {offDayLabel ? <span className="day-pill-off-label">{offDayLabel}</span> : null}
                                    {hasEvents ? <span className="day-dot" aria-hidden="true" /> : <span className="day-dot day-dot-empty" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </div>

                    <div className="calendar-mobile-events">
                        {mobileEvents.map((event, index) => {
                            const tone = event.resource?.key;
                            const badgeClass = tone === 'lateness'
                                ? 'badge-late'
                                : tone === 'absence'
                                    ? 'badge-absent'
                                    : tone === 'leave'
                                        ? 'badge-leave'
                                        : 'badge-present';
                            return (
                                <button
                                    key={`${event.title}-${event.start.toISOString()}-${index}`}
                                    className={`event-card${isCompanyOffDay(event.start, schedule?.calendarOffDays) ? ' is-disabled' : ''}`}
                                    onClick={() => {
                                        const selected = event.start as Date;
                                        if (isCompanyOffDay(selected, schedule?.calendarOffDays)) return;
                                        if (onSelectEvent) {
                                            onSelectEvent(event);
                                            return;
                                        }
                                        handleSelectDate(selected);
                                    }}
                                    disabled={isCompanyOffDay(event.start, schedule?.calendarOffDays)}
                                >
                                    <span className="day-dot" aria-hidden="true" />
                                    <span className="event-card-title">{event.title}</span>
                                    <span className={badgeClass}>{event.title}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="calendar-mobile-stats">
                        <div className="stat-card">
                            <p>{tRequestModal('permissionArrival')}</p>
                            <p className="stat-value">{mobileStats.attendanceCount}</p>
                        </div>
                        <div className="stat-card">
                            <p>{tDashboard('eventLateness')}</p>
                            <p className="stat-value warn">{mobileStats.lateCount}</p>
                        </div>
                        <div className="stat-card">
                            <p>{tDashboard('eventAbsence')}</p>
                            <p className="stat-value">{mobileStats.absentCount}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    ref={calendarGridRef}
                    onMouseMove={handleGridMouseMove}
                    onMouseLeave={handleGridMouseLeave}
                    onClick={handleGridClick}
                    className="w-full overflow-x-auto sm:overflow-visible"
                >
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
                            handleSelectDate(selected);
                        }}
                        onSelectEvent={(event) => {
                            const selected = event.start as Date;
                            if (isCompanyOffDay(selected, schedule?.calendarOffDays)) return;
                            if (onSelectEvent) {
                                onSelectEvent(event);
                                return;
                            }
                            handleSelectDate(selected);
                        }}
                        startAccessor="start"
                        endAccessor="end"
                        eventPropGetter={eventPropGetter}
                        components={{
                            dateCellWrapper: DateCellWrapper,
                            month: {
                                dateHeader: CalendarDateHeader,
                            },
                        }}
                        formats={{
                            weekdayFormat: fullWeekdayFormat,
                            dayFormat: fullWeekdayFormat,
                            dayHeaderFormat: (date: Date) => `${fullWeekdayFormat(date)} ${format(date, 'd MMM', { locale: calendarLocale })}`,
                        }}
                        scrollToTime={new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 7)}
                        className="rbc-sphinx"
                        style={{ height: viewportWidth < 768 ? 460 : 540, width: '100%' }}
                        dayPropGetter={(date) => {
                            const isRamadan =
                                !!ramadanRange &&
                                dateOnly(date) >= ramadanRange.start &&
                                dateOnly(date) <= ramadanRange.end;
                            const offDayKind = getCompanyOffDayKind(date, schedule?.calendarOffDays);
                            const offDayLabel = getCompanyOffDayLabel(date, locale, schedule?.calendarOffDays);
                            if (offDayKind) {
                                const offDayClass = offDayKind === 'friday' ? 'rbc-day-friday' : `rbc-day-${offDayKind}`;
                                return {
                                    className: `rbc-day-disabled ${offDayClass}`,
                                    style: {
                                        color: 'var(--calendar-day-disabled-text)',
                                        pointerEvents: 'none',
                                    },
                                    ...(offDayLabel ? { title: offDayLabel } : {}),
                                };
                            }
                            if (isSameDay(date, new Date())) {
                                return { className: `rbc-day-clickable rbc-day-today${isRamadan ? ' rbc-day-ramadan' : ''}` };
                            }
                            if (isRamadan) {
                                return { className: 'rbc-day-clickable rbc-day-ramadan' };
                            }
                            return { className: 'rbc-day-clickable rbc-day-default' };
                        }}
                    />
                </div>
            )}
            <SpotlightGuide
                open={guideOpen}
                steps={guideSteps}
                currentStep={currentGuideStep}
                onClose={() => setGuideOpen(false)}
                onStepChange={setCurrentGuideStep}
            />
            <style jsx global>{`
                .dashboard-page .calendar-shell,
                .dashboard-page .calendar-shell .rbc-sphinx,
                .dashboard-page .calendar-shell .rbc-month-view {
                    width: 100%;
                }

                .dashboard-page .calendar-shell .rbc-month-row {
                    min-height: 70px;
                    height: auto;
                }
            `}</style>
        </div>
    );
}
