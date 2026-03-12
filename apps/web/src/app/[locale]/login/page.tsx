'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import BrandLogo from '@/components/BrandLogo';
import { Eye, EyeOff, Languages, Moon, Sun } from 'lucide-react';
import { AppApiError } from '@/lib/api';
import Link from 'next/link';

export default function LoginPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    const t = useTranslations('auth');
    const router = useRouter();
    const pathname = usePathname();
    const { setUser } = useAuthStore();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ identifier?: string; password?: string; form?: string }>({});
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

    const validate = () => {
        const nextErrors: { identifier?: string; password?: string } = {};
        if (!identifier.trim()) {
            nextErrors.identifier = t('loginEmailRequired');
        }
        if (!password.trim()) {
            nextErrors.password = t('loginPasswordRequired');
        } else if (password.trim().length < 6) {
            nextErrors.password = t('loginPasswordShort');
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const formatLoginError = (error: unknown) => {
        const err = error as AppApiError;

        if (!err?.status) return t('loginNetworkError');
        if (err.status === 401) return t('loginInvalid');
        if (err.status === 403) {
            if (err.message?.toLowerCase().includes('locked')) return t('loginLocked');
            if (err.message?.toLowerCase().includes('deactivated')) return t('loginDeactivated');
            return t('loginForbidden');
        }
        if (err.status === 429) return t('loginTooMany');
        if (err.status >= 500) return t('loginServerError');

        return err.message || t('loginUnknownError');
    };

    const submit = async () => {
        if (loading || !validate()) return;
        setLoading(true);
        setErrors({});
        try {
            await api.get('/auth/csrf');
            const res = await api.post('/auth/login', { identifier: identifier.trim(), password, rememberMe });
            setUser(res.data.user);
            const target = `/${params.locale}`;
            router.push(target);
            setTimeout(() => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
                    window.location.href = target;
                }
            }, 600);
        } catch (error) {
            setErrors({ form: formatLoginError(error) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center px-4 py-8 sm:px-6">
            <div className="absolute end-4 top-4 flex items-center gap-2">
                <button
                    className="btn-outline text-xs sm:text-sm"
                    onClick={() => switchLocale(params.locale === 'ar' ? 'en' : 'ar')}
                    title={params.locale === 'ar' ? 'English' : 'العربية'}
                    aria-label={params.locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
                >
                    <Languages size={16} />
                </button>
                <button
                    className="btn-outline text-xs sm:text-sm"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Light' : 'Dark'}
                    aria-label={theme === 'dark' ? 'Light' : 'Dark'}
                >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
            </div>
            <div className="card w-full max-w-md p-5 sm:p-8">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex justify-center">
                        <BrandLogo locale={params.locale} />
                    </div>
                    <h1 className="text-xl font-semibold sm:text-2xl">{t('welcome')}</h1>
                    <p className="text-sm text-ink/60">{t('loginHint')}</p>
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    className="space-y-4"
                >
                    <label className="text-sm">
                        {params.locale === 'ar' ? 'البريد الإلكتروني / اسم المستخدم' : 'Email / Username'}
                        <input
                            type="text"
                            className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                            aria-invalid={!!errors.identifier}
                        />
                        {errors.identifier && <p className="mt-1 text-xs text-red-600">{errors.identifier}</p>}
                    </label>
                    <label className="text-sm">
                        {t('password')}
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2 pe-11"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                aria-invalid={!!errors.password}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-ink/60"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        {t('rememberMe')}
                    </label>
                    <button
                        className="btn-primary w-full"
                        type="button"
                        disabled={loading}
                        onClick={submit}
                    >
                        {loading ? (params.locale === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing in...') : t('login')}
                    </button>
                    <div className="flex items-center justify-between text-sm">
                        <Link className="text-ink/70 hover:text-ink" href={`/${params.locale}/forgot-password`}>
                            {t('reset')}
                        </Link>
                    </div>
                    {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
                </form>
            </div>
        </div>
    );
}

