'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Languages, Moon, Sun } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import api from '@/lib/api';

export default function ResetPasswordPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    const t = useTranslations('auth');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
    const hasToken = !!token;
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [identifier, setIdentifier] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

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

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setMessage('');
        setError('');
        if (!hasToken && (!identifier.trim() || !code.trim())) {
            setError(t('resetCodeRequired'));
            return;
        }
        if (!password.trim() || password.trim().length < 8) {
            setError(t('passwordWeak'));
            return;
        }
        if (password !== confirm) {
            setError(t('passwordMismatch'));
            return;
        }
        setLoading(true);
        try {
            await api.post('/auth/reset-password', {
                token: hasToken ? token : code.trim(),
                identifier: hasToken ? undefined : identifier.trim(),
                newPassword: password,
            });
            setMessage(t('resetDone'));
            setIdentifier('');
            setCode('');
            setPassword('');
            setConfirm('');
            if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem('sphinx-logged-out');
            }
            router.push(`/${params.locale}`);
        } catch (err: any) {
            setError(err?.message || t('resetFailed'));
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
                    <h1 className="text-xl font-semibold sm:text-2xl">{t('resetTitle')}</h1>
                    <p className="text-sm text-ink/60">{hasToken ? t('resetCreateNew') : t('resetCodeHint')}</p>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    {!hasToken && (
                        <>
                            <label className="text-sm">
                                {t('resetIdentifier')}
                                <input
                                    type="text"
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder={t('resetIdentifierHint')}
                                    required
                                />
                            </label>
                            <label className="text-sm">
                                {t('resetCode')}
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="123456"
                                    required
                                />
                            </label>
                        </>
                    )}
                    <label className="text-sm">
                        {t('newPassword')}
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2 pe-11"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
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
                    </label>
                    <label className="text-sm">
                        {t('confirmPassword')}
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                        />
                    </label>
                    <button className="btn-primary w-full" type="submit" disabled={loading}>
                        {loading ? t('sending') : t('savePassword')}
                    </button>
                    {message && <p className="text-sm text-emerald-600">{message}</p>}
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button
                        type="button"
                        className="btn-outline w-full"
                        onClick={() => router.push(`/${params.locale}/login`)}
                    >
                        {t('backToLogin')}
                    </button>
                </form>
            </div>
        </div>
    );
}
