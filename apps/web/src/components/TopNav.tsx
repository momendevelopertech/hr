'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function TopNav({ locale }: { locale: string }) {
    const t = useTranslations('nav');
    const router = useRouter();
    const pathname = usePathname();
    const { user, setUser } = useAuthStore();

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
        <header className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-2xl bg-ink text-sand flex items-center justify-center font-bold">
                    S
                </div>
                <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-ink/60">SPHINX HR</p>
                    <p className="text-lg font-semibold text-ink">{t('dashboard')}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button className="btn-outline" onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}>
                    {locale === 'ar' ? 'EN' : 'AR'}
                </button>
                <div className="hidden md:flex items-center gap-3 rounded-xl bg-white/70 px-4 py-2">
                    <div className="h-9 w-9 rounded-full bg-cactus/20 flex items-center justify-center font-semibold">
                        {user?.fullName?.slice(0, 1) || 'U'}
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{user?.fullName || 'User'}</p>
                        <p className="text-xs text-ink/60">{user?.role || ''}</p>
                    </div>
                </div>
                <button className="btn-secondary" onClick={logout}>
                    {t('logout')}
                </button>
            </div>
        </header>
    );
}
