'use client';

import { useTranslations } from 'next-intl';
import { CalendarClock, Clock3, FileClock, WalletCards } from 'lucide-react';

type Stat = {
    label: string;
    value?: string;
    rows?: Array<{
        label: string;
        value: string;
        valueClassName?: string;
    }>;
    hint?: string;
};

const cardStyles: Record<string, { icon: any; shell: string; iconBg: string }> = {
    leaveBalance: { icon: WalletCards, shell: 'from-cyan-50 to-cyan-100/60', iconBg: 'bg-cyan-500/15 text-cyan-700' },
    permissionHours: { icon: Clock3, shell: 'from-violet-50 to-violet-100/60', iconBg: 'bg-violet-500/15 text-violet-700' },
    pendingApprovals: { icon: FileClock, shell: 'from-amber-50 to-amber-100/60', iconBg: 'bg-amber-500/15 text-amber-700' },
    absenceDeduction: { icon: CalendarClock, shell: 'from-rose-50 to-rose-100/60', iconBg: 'bg-rose-500/15 text-rose-700' },
};

export default function StatsGrid({ stats }: { stats: Stat[] }) {
    const t = useTranslations('dashboard');
    return (
        <section className="grid grid-cols-1 gap-3 px-4 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
                const style = cardStyles[stat.label] || cardStyles.leaveBalance;
                const Icon = style.icon;
                return (
                    <div key={stat.label} className={`card min-w-0 p-4 min-h-[120px] bg-gradient-to-br ${style.shell}`}>
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-[clamp(11px,0.9vw,14px)] uppercase tracking-[0.16em] text-ink/60">
                                {t(stat.label as any) ?? stat.label}
                            </p>
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.iconBg}`}>
                                <Icon size={16} />
                            </div>
                        </div>
                        {stat.rows ? (
                            <div className="mt-2.5 space-y-2">
                                {stat.rows.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between gap-3">
                                        <p className="text-[clamp(11px,0.9vw,14px)] uppercase tracking-[0.06em] text-ink/70">
                                            {t(row.label as any) ?? row.label}
                                        </p>
                                        <p className={`text-[clamp(14px,1.1vw,18px)] font-semibold ${row.valueClassName ?? 'text-ink'}`}>
                                            {row.value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2.5 text-[clamp(18px,1.8vw,28px)] font-semibold text-ink">{stat.value}</p>
                        )}
                        {stat.hint && (
                            <p className="mt-1.5 text-[clamp(11px,0.9vw,14px)] text-ink/70">{stat.hint}</p>
                        )}
                    </div>
                );
            })}
        </section>
    );
}
