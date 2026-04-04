import { format } from 'date-fns';

export type CompanyOffDayKind = 'friday' | 'est1' | 'est2' | null;

const COMPANY_FIXED_OFF_DAY_BY_MONTH_DAY: Record<string, Exclude<CompanyOffDayKind, 'friday' | null>> = {
    '01-23': 'est1',
    '01-24': 'est2',
    '03-27': 'est1',
    '03-28': 'est2',
    '05-15': 'est1',
    '05-16': 'est2',
    '07-03': 'est1',
    '07-04': 'est2',
    '10-09': 'est1',
    '10-10': 'est2',
    '12-11': 'est1',
    '12-12': 'est2',
};

const OFF_DAY_LABELS = {
    en: {
        friday: '💤 Day off',
        est1: 'EST I',
        est2: 'EST II',
    },
    ar: {
        friday: '💤 يوم إجازة',
        est1: 'EST I',
        est2: 'EST II',
    },
} as const;

const getMonthDayKey = (date: Date) => format(date, 'MM-dd');

export const getCompanyOffDayKind = (date: Date): CompanyOffDayKind => {
    if (date.getDay() === 5) return 'friday';
    return COMPANY_FIXED_OFF_DAY_BY_MONTH_DAY[getMonthDayKey(date)] || null;
};

export const getCompanyOffDayLabel = (date: Date, locale: 'en' | 'ar' = 'en') => {
    const kind = getCompanyOffDayKind(date);
    if (!kind) return null;
    return OFF_DAY_LABELS[locale][kind];
};

export const isCompanyFixedOffDay = (date: Date) => Boolean(COMPANY_FIXED_OFF_DAY_BY_MONTH_DAY[getMonthDayKey(date)]);

export const isCompanyOffDay = (date: Date) => getCompanyOffDayKind(date) !== null;
