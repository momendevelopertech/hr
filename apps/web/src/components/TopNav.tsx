'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import api, { clearApiCache, clearBrowserRuntimeCache } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import BrandLogo from './BrandLogo';
import PwaInstallButton from './PwaInstallButton';
import { KeyRound, Languages, LogOut, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TopNav({ locale }: { locale: string }) {
    const t = useTranslations('nav');
    const router = useRouter();
    const pathname = usePathname();
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const isDashboard = normalizedPath === `/${locale}`;
    const { user, setUser, setBootstrapped } = useAuthStore();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [pwaEnabled, setPwaEnabled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null;
        const next = stored === 'dark' ? 'dark' : 'light';
        setTheme(next);
        if (typeof document !== 'undefined') {
            document.documentElement.dataset.theme = next;
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        api.get('/settings/work-schedule')
            .then((res) => setPwaEnabled(!!res.data?.pwaInstallEnabled))
            .catch(() => null);
    }, [user]);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
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
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('sphinx-logged-out', '1');
        }
        try {
            await api.post('/auth/logout');
        } catch {
            // Ignore logout network errors and continue client-side sign out.
        }
        await clearBrowserRuntimeCache();
        clearApiCache();
        setUser(null);
        setBootstrapped(false);
        router.push(`/${locale}/login`);
    };

    const requestPasswordReset = async () => {
        if (!user?.email) {
            toast.error(locale === 'ar' ? 'لا يوجد بريد إلكتروني مسجل لهذا المستخدم.' : 'No email found for this user.');
            return;
        }
        try {
            await api.post('/auth/forgot-password', { email: user.email, locale });
            toast.success(locale === 'ar' ? 'تم إرسال رابط تغيير كلمة المرور إلى بريدك الإلكتروني.' : 'Password reset link sent to your email.');
            setMenuOpen(false);
        } catch (error: any) {
            toast.error(error?.message || (locale === 'ar' ? 'تعذر إرسال الرابط.' : 'Failed to send reset link.'));
        }
    };

    return (
        <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-center gap-3">
                <BrandLogo locale={locale} compact />
                <div>
                    <p className={`uppercase tracking-[0.2em] text-ink/60 ${isDashboard ? 'text-[clamp(11px,0.9vw,14px)]' : 'text-xs'}`}>
                        SPHINX HR
                    </p>
                    <p className={`font-semibold text-ink ${isDashboard ? 'text-[clamp(14px,1.2vw,18px)]' : 'text-lg'}`}>
                        {t('dashboard')}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                    className="btn-outline text-xs sm:text-sm"
                    onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}
                    title={locale === 'ar' ? 'English' : 'العربية'}
                    aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
                >
                    <Languages size={16} />
                </button>
                <button
                    className="btn-outline text-xs sm:text-sm"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? t('themeLight') : t('themeDark')}
                    aria-label={theme === 'dark' ? t('themeLight') : t('themeDark')}
                >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <PwaInstallButton enabled={pwaEnabled} />
                <div className="relative" ref={menuRef}>
                    <button
                        className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2"
                        onClick={() => setMenuOpen((v) => !v)}
                    >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cactus/20 font-semibold">
                            {user?.fullName?.slice(0, 1) || 'U'}
                        </div>
                        <div>
                            <p className="text-sm font-semibold">{user?.fullName || t('profile')}</p>
                            <p className="text-xs text-ink/60">{user?.role || ''}</p>
                        </div>
                    </button>
                    {menuOpen && (
                        <div className="absolute end-0 z-20 mt-2 w-56 rounded-xl border border-ink/10 bg-white p-2 shadow-lg">
                            <button
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-ink/5"
                                onClick={requestPasswordReset}
                            >
                                <KeyRound size={16} />
                                {locale === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                            </button>
                            <button
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                onClick={() => {
                                    setMenuOpen(false);
                                    logout();
                                }}
                            >
                                <LogOut size={16} />
                                {t('logout')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

