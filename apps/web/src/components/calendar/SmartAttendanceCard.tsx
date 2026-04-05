'use client';

import { useTranslations } from 'next-intl';
import styles from './SmartAttendanceCard.module.css';

export type WeekStatus = {
    dayKey: string;
    status: 'present' | 'late' | 'absent' | 'leave' | 'off' | 'today' | 'holiday';
};

export type SmartAttendanceData = {
    attendanceDays: number;
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

    const stats = (
        <div className={[styles.stats, styles[variant]].join(' ')}>
            <div className={styles.statBox}>
                <div className={[styles.statNum, styles.numGreen].join(' ')}>{data.attendanceDays}</div>
                <div className={styles.statLbl}>{t('attendanceStat')}</div>
            </div>
            <div className={styles.statBox}>
                <div className={styles.statNum}>{data.remainingDays}</div>
                <div className={styles.statLbl}>{t('remainingStat')}</div>
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
