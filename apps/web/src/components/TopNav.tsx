'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import BrandLogo from './BrandLogo';

export default function TopNav({ locale }: { locale: string }) {
    const t = useTranslations('nav');
    const router = useRouter();
    const pathname = usePathname();
    const { user, setUser } = useAuthStore();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null;
        const next = stored === 'dark' ? 'dark' : 'light';
        setTheme(next);
        if (typeof document !== 'undefined') {
            document.documentElement.dataset.theme = next;
        }
    }, []);

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        if (typeof document !== 'undefined') {
            document.documentElement.dataset.theme = next;
        }
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('theme', next);
        }
    };

    const switchLocale = (nextLocale: string) => {
        const segments = pathname.split('/');
        segments[1] = nextLocale;
        router.push(segments.join('/'));
    };

    const logout = async () => {
        await api.post('/auth/logout');
        setUser(null);
        router.push(`/${locale}/login`);
    };

    return (
        <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-center gap-3">
                <BrandLogo locale={locale} compact />
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/60">SPHINX HR</p>
                    <p className="text-lg font-semibold text-ink">{t('dashboard')}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button className="btn-outline text-xs sm:text-sm" onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}>
                    {locale === 'ar' ? 'EN' : 'AR'}
                </button>
                <button className="btn-outline text-xs sm:text-sm" onClick={toggleTheme}>
                    {theme === 'dark' ? t('themeLight') : t('themeDark')}
                </button>
                <div className="hidden md:flex items-center gap-3 rounded-xl bg-white/70 px-4 py-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cactus/20 font-semibold">
                        {user?.fullName?.slice(0, 1) || 'U'}
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{user?.fullName || t('profile')}</p>
                        <p className="text-xs text-ink/60">{user?.role || ''}</p>
                    </div>
                </div>
                <button className="btn-secondary text-xs sm:text-sm" onClick={logout}>
                    {t('logout')}
                </button>
            </div>
        </header>
    );
}

