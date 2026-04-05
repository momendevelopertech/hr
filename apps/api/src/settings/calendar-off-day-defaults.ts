export type CalendarOffDayType = 'est1' | 'est2' | 'holiday';

export type CalendarOffDayRule = {
    id: string;
    type: CalendarOffDayType;
    nameAr: string;
    nameEn: string;
    startDate: string;
    endDate: string;
    isRecurringAnnual?: boolean;
    enabled?: boolean;
};

const DEFAULT_CALENDAR_OFF_DAYS: CalendarOffDayRule[] = [
    { id: 'est-jan-1', type: 'est1', nameAr: 'EST I', nameEn: 'EST I', startDate: '2026-01-23', endDate: '2026-01-23', isRecurringAnnual: true, enabled: true },
    { id: 'est-jan-2', type: 'est2', nameAr: 'EST II', nameEn: 'EST II', startDate: '2026-01-24', endDate: '2026-01-24', isRecurringAnnual: true, enabled: true },
    { id: 'est-mar-1', type: 'est1', nameAr: 'EST I', nameEn: 'EST I', startDate: '2026-03-27', endDate: '2026-03-27', isRecurringAnnual: true, enabled: true },
    { id: 'est-mar-2', type: 'est2', nameAr: 'EST II', nameEn: 'EST II', startDate: '2026-03-28', endDate: '2026-03-28', isRecurringAnnual: true, enabled: true },
    { id: 'est-may-1', type: 'est1', nameAr: 'EST I', nameEn: 'EST I', startDate: '2026-05-15', endDate: '2026-05-15', isRecurringAnnual: true, enabled: true },
    { id: 'est-may-2', type: 'est2', nameAr: 'EST II', nameEn: 'EST II', startDate: '2026-05-16', endDate: '2026-05-16', isRecurringAnnual: true, enabled: true },
    { id: 'est-jul-1', type: 'est1', nameAr: 'EST I', nameEn: 'EST I', startDate: '2026-07-03', endDate: '2026-07-03', isRecurringAnnual: true, enabled: true },
    { id: 'est-jul-2', type: 'est2', nameAr: 'EST II', nameEn: 'EST II', startDate: '2026-07-04', endDate: '2026-07-04', isRecurringAnnual: true, enabled: true },
    { id: 'est-oct-1', type: 'est1', nameAr: 'EST I', nameEn: 'EST I', startDate: '2026-10-09', endDate: '2026-10-09', isRecurringAnnual: true, enabled: true },
    { id: 'est-oct-2', type: 'est2', nameAr: 'EST II', nameEn: 'EST II', startDate: '2026-10-10', endDate: '2026-10-10', isRecurringAnnual: true, enabled: true },
    { id: 'est-dec-1', type: 'est1', nameAr: 'EST I', nameEn: 'EST I', startDate: '2026-12-11', endDate: '2026-12-11', isRecurringAnnual: true, enabled: true },
    { id: 'est-dec-2', type: 'est2', nameAr: 'EST II', nameEn: 'EST II', startDate: '2026-12-12', endDate: '2026-12-12', isRecurringAnnual: true, enabled: true },
    { id: 'holiday-2026-christmas', type: 'holiday', nameAr: 'عيد الميلاد المجيد', nameEn: 'Coptic Christmas', startDate: '2026-01-07', endDate: '2026-01-07', isRecurringAnnual: true, enabled: true },
    { id: 'holiday-2026-police', type: 'holiday', nameAr: 'ثورة 25 يناير وعيد الشرطة', nameEn: 'January 25 Revolution and Police Day', startDate: '2026-01-29', endDate: '2026-01-29', enabled: true },
    { id: 'holiday-2026-eid-fitr', type: 'holiday', nameAr: 'عيد الفطر المبارك', nameEn: 'Eid al-Fitr', startDate: '2026-03-19', endDate: '2026-03-23', enabled: true },
    { id: 'holiday-2026-sham-elnessim', type: 'holiday', nameAr: 'عيد شم النسيم', nameEn: 'Sham El-Nessim', startDate: '2026-04-13', endDate: '2026-04-13', enabled: true },
    { id: 'holiday-2026-sinai', type: 'holiday', nameAr: 'عيد تحرير سيناء', nameEn: 'Sinai Liberation Day', startDate: '2026-04-25', endDate: '2026-04-25', isRecurringAnnual: true, enabled: true },
    { id: 'holiday-2026-labour', type: 'holiday', nameAr: 'عيد العمال', nameEn: 'Labour Day', startDate: '2026-05-01', endDate: '2026-05-01', isRecurringAnnual: true, enabled: true },
    { id: 'holiday-2026-arafa', type: 'holiday', nameAr: 'وقفة عيد الأضحى المبارك', nameEn: 'Arafat Day', startDate: '2026-05-26', endDate: '2026-05-26', enabled: true },
    { id: 'holiday-2026-eid-adha', type: 'holiday', nameAr: 'عيد الأضحى المبارك', nameEn: 'Eid al-Adha', startDate: '2026-05-27', endDate: '2026-05-29', enabled: true },
    { id: 'holiday-2026-hijri', type: 'holiday', nameAr: 'رأس السنة الهجرية', nameEn: 'Islamic New Year', startDate: '2026-06-17', endDate: '2026-06-17', enabled: true },
    { id: 'holiday-2026-june-30', type: 'holiday', nameAr: 'ثورة 30 يونيو', nameEn: 'June 30 Revolution', startDate: '2026-06-30', endDate: '2026-06-30', isRecurringAnnual: true, enabled: true },
    { id: 'holiday-2026-july-23', type: 'holiday', nameAr: 'ثورة 23 يوليو 1952', nameEn: 'July 23 Revolution', startDate: '2026-07-23', endDate: '2026-07-23', isRecurringAnnual: true, enabled: true },
    { id: 'holiday-2026-mawlid', type: 'holiday', nameAr: 'المولد النبوي الشريف', nameEn: 'Prophet Muhammad Birthday', startDate: '2026-08-26', endDate: '2026-08-26', enabled: true },
    { id: 'holiday-2026-october-war', type: 'holiday', nameAr: 'عيد القوات المسلحة', nameEn: 'Armed Forces Day', startDate: '2026-10-06', endDate: '2026-10-06', isRecurringAnnual: true, enabled: true },
];

export const getDefaultCalendarOffDays = (): CalendarOffDayRule[] =>
    DEFAULT_CALENDAR_OFF_DAYS.map((rule) => ({ ...rule }));

export const normalizeCalendarOffDays = (input: unknown): CalendarOffDayRule[] => {
    if (!Array.isArray(input)) {
        return getDefaultCalendarOffDays();
    }

    const sanitized = input
        .map<CalendarOffDayRule | null>((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const candidate = item as Record<string, unknown>;
            const type = candidate.type;
            if (type !== 'est1' && type !== 'est2' && type !== 'holiday') return null;
            const startDate = typeof candidate.startDate === 'string' ? candidate.startDate : '';
            const endDate = typeof candidate.endDate === 'string' ? candidate.endDate : startDate;
            const nameAr = typeof candidate.nameAr === 'string' ? candidate.nameAr.trim() : '';
            const nameEn = typeof candidate.nameEn === 'string' ? candidate.nameEn.trim() : '';
            if (!startDate || !endDate || !nameAr || !nameEn) return null;

            return {
                id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : `${type}-${index + 1}`,
                type,
                nameAr,
                nameEn,
                startDate,
                endDate,
                isRecurringAnnual: candidate.isRecurringAnnual === true,
                enabled: candidate.enabled !== false,
            } satisfies CalendarOffDayRule;
        })
        .filter((item): item is CalendarOffDayRule => item !== null);

    return sanitized.length > 0 ? sanitized : getDefaultCalendarOffDays();
};
