'use client';

import { useTranslations } from 'next-intl';

type Stat = {
    label: string;
    value: string;
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
                    <p className="mt-3 text-2xl font-semibold text-ink">{stat.value}</p>
                    {stat.hint && <p className="mt-2 text-xs text-ink/60">{stat.hint}</p>}
                </div>
            ))}
        </section>
    );
}
