import { format } from 'date-fns';

/**
 * Company-wide fixed off-days (EST I / EST II) that apply to all employees.
 */
export const COMPANY_FIXED_OFF_DAYS = new Set([
    '2026-01-23',
    '2026-01-24',
    '2026-03-27',
    '2026-03-28',
    '2026-05-15',
    '2026-05-16',
    '2026-07-03',
    '2026-07-04',
    '2026-10-09',
    '2026-10-10',
    '2026-12-11',
    '2026-12-12',
]);

export const isCompanyFixedOffDay = (date: Date) => COMPANY_FIXED_OFF_DAYS.has(format(date, 'yyyy-MM-dd'));

export const isCompanyOffDay = (date: Date) => date.getDay() === 5 || isCompanyFixedOffDay(date);
