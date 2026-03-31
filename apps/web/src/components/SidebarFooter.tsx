'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import api, { clearApiCache, clearBrowserRuntimeCache } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { KeyRound, Languages, LogOut, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import PwaInstallButton from './PwaInstallButton';
import WorkflowModeSwitch from './WorkflowModeSwitch';

export default function SidebarFooter({
    locale,
    collapsed = false,
}: {
    locale: string;
    collapsed?: boolean;
}) {
    const t = useTranslations('nav');
    const router = useRouter();
    const pathname = usePathname();
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
        <div className={`sidebar-footer${collapsed ? ' is-collapsed' : ''}`} ref={menuRef}>
            <WorkflowModeSwitch locale={locale} collapsed={collapsed} />
            <div className="sidebar-tools">
                <button className="tb-icon" type="button" onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')} title={locale === 'ar' ? 'English' : 'العربية'}>
                    <Languages size={14} />
                </button>
                <button className="tb-icon" type="button" onClick={toggleTheme} title={theme === 'dark' ? t('themeLight') : t('themeDark')}>
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                {!collapsed && <PwaInstallButton enabled={pwaEnabled} />}
            </div>
            <button className={`user-row${collapsed ? ' is-collapsed' : ''}`} type="button" onClick={() => setMenuOpen((v) => !v)}>
                <div className="uav">{user?.fullName?.slice(0, 1) || 'U'}</div>
                {!collapsed && (
                    <div>
                        <div className="uname">{user?.fullName || t('profile')}</div>
                        <div className="urole">{user?.role || ''}</div>
                    </div>
                )}
            </button>
            {menuOpen && (
                <div className="sidebar-menu">
                    <button className="sidebar-menu-item" type="button" onClick={requestPasswordReset}>
                        <KeyRound size={14} />
                        {locale === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                    </button>
                    <button className="sidebar-menu-item text-rose-600" type="button" onClick={() => { setMenuOpen(false); logout(); }}>
                        <LogOut size={14} />
                        {t('logout')}
                    </button>
                </div>
            )}
        </div>
    );
}
