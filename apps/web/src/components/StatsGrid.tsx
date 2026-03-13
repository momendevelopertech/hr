'use client';

import { useTranslations } from 'next-intl';

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

export default function StatsGrid({ stats }: { stats: Stat[] }) {
    const t = useTranslations('dashboard');
    return (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 px-6">
            {stats.map((stat) => (
                <div key={stat.label} className="card p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                        {t(stat.label as any) ?? stat.label}
                    </p>
                    {stat.rows ? (
                        <div className="mt-3 space-y-3">
                            {stat.rows.map((row) => (
                                <div key={row.label} className="flex items-center justify-between gap-3">
                                    <p className="text-xs uppercase tracking-[0.08em] text-ink/60">{t(row.label as any) ?? row.label}</p>
                                    <p className={`text-xl font-semibold ${row.valueClassName ?? 'text-ink'}`}>{row.value}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-3 text-2xl font-semibold text-ink">{stat.value}</p>
                    )}
                    {stat.hint && <p className="mt-2 text-xs text-ink/60">{stat.hint}</p>}
                </div>
            ))}
        </section>
    );
}
