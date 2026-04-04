'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import styles from './SmartAttendanceCard.module.css';

export type WeekStatus = {
    dayKey: string;
    status: 'present' | 'late' | 'absent' | 'off' | 'today' | 'holiday';
};

export type SmartAttendanceData = {
    attendanceDays: number;
    lateDays: number;
    absentDays: number;
    remainingDays: number;
    monthProgress: number;
    currentWeekStatus: WeekStatus[];
    currentMonthLabel: string;
};

export default function SmartAttendanceCard({
    variant,
    data,
    className,
}: {
    variant: 'sidebar' | 'bar' | 'card';
    data: SmartAttendanceData;
    className?: string;
}) {
    const t = useTranslations('dashboard');
    const locale = useLocale();
    const attendanceLabel = locale === 'ar' ? 'حضور' : 'Attendance';
    const remainingLabel = locale === 'ar' ? 'متبقي' : 'Remaining';

    const stats = (
        <div className={[styles.stats, styles[variant]].join(' ')}>
            <div className={styles.statBox}>
                <div className={[styles.statNum, styles.numGreen].join(' ')}>{data.attendanceDays}</div>
                <div className={styles.statLbl}>{attendanceLabel}</div>
            </div>
            <div className={styles.statBox}>
                <div className={[styles.statNum, styles.numAmber].join(' ')}>{data.lateDays}</div>
                <div className={styles.statLbl}>{t('eventLateness')}</div>
            </div>
            <div className={styles.statBox}>
                <div className={[styles.statNum, styles.numRed].join(' ')}>{data.absentDays}</div>
                <div className={styles.statLbl}>{t('eventAbsence')}</div>
            </div>
            <div className={styles.statBox}>
                <div className={styles.statNum}>{data.remainingDays}</div>
                <div className={styles.statLbl}>{remainingLabel}</div>
            </div>
        </div>
    );

    const weekStrip = (
        <div className={styles.weekStrip}>
            {data.currentWeekStatus.map((day) => (
                <div key={day.dayKey} className={[styles.dayPill, styles[day.status]].join(' ')}>
                    <span className={styles.dayName}>{day.dayKey}</span>
                    <span className={styles.dayDot} aria-hidden="true" />
                </div>
            ))}
        </div>
    );

    if (variant === 'bar') {
        return (
            <section className={[styles.root, styles.barRoot, className].filter(Boolean).join(' ')}>
                <div className={styles.barMeta}>
                    <div className={styles.header}>
                        <div className={styles.month}>{data.currentMonthLabel}</div>
                    </div>
                    <div className={styles.progressWrap}>
                        <div className={styles.progressTrack}>
                            <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(100, data.monthProgress))}%` }} />
                        </div>
                        <span className={styles.progressText}>{Math.round(data.monthProgress)}%</span>
                    </div>
                </div>
                {stats}
                <div className="min-w-[140px] flex-1">{weekStrip}</div>
            </section>
        );
    }

    return (
        <section className={[styles.root, className].filter(Boolean).join(' ')}>
            <div className={styles.header}>
                <div className={styles.title}>{t('quickGlanceTitle')}</div>
                <div className={styles.month}>{data.currentMonthLabel}</div>
            </div>
            <div className={styles.progressWrap}>
                <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(100, data.monthProgress))}%` }} />
                </div>
                <span className={styles.progressText}>{Math.round(data.monthProgress)}%</span>
            </div>
            {stats}
            {weekStrip}
        </section>
    );
}
