'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';

export default function NavLinks({ locale }: { locale: string }) {
    const t = useTranslations('nav');
    const pathname = usePathname();
    const { user } = useAuthStore();
    const canAdminPages = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    const links = [
        { href: `/${locale}`, label: t('dashboard') },
        { href: `/${locale}/requests`, label: t('requests') },
        { href: `/${locale}/chat`, label: t('chat') },
        ...(canAdminPages
            ? [
                { href: `/${locale}/employees`, label: t('employees') },
                { href: `/${locale}/departments`, label: t('departments') },
                { href: `/${locale}/forms`, label: t('forms') },
                { href: `/${locale}/reports`, label: t('reports') },
            ]
            : []),
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
