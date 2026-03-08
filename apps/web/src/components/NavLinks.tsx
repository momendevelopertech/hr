'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function NavLinks({ locale }: { locale: string }) {
    const t = useTranslations('nav');
    const pathname = usePathname();
    const links = [
        { href: `/${locale}`, label: t('dashboard') },
        { href: `/${locale}/requests`, label: t('requests') },
        { href: `/${locale}/employees`, label: 'Employees' },
        { href: `/${locale}/departments`, label: 'Departments' },
        { href: `/${locale}/forms`, label: 'Forms' },
        { href: `/${locale}/reports`, label: t('reports') },
        { href: `/${locale}/notifications`, label: t('notifications') },
    ];

    return (
        <nav className="flex flex-wrap gap-2 px-6 pb-4">
            {links.map((link) => {
                const active = pathname === link.href;
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`btn-outline ${active ? 'bg-ink/10' : ''}`}
                    >
                        {link.label}
                    </Link>
                );
            })}
        </nav>
    );
}
