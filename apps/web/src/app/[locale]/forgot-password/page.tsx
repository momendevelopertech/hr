'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Languages, Moon, Sun } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import api from '@/lib/api';

export default function ForgotPasswordPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    const t = useTranslations('auth');
    const router = useRouter();
    const pathname = usePathname();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [email, setEmail] = useState('');
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
        if (!email.trim() || loading) return;
        setLoading(true);
        setMessage('');
        setError('');
        try {
            await api.post('/auth/forgot-password', { email: email.trim(), locale: params.locale });
            setMessage(t('resetSent'));
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
                    <p className="text-sm text-ink/60">{t('resetHint')}</p>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    <label className="text-sm">
                        {t('email')}
                        <input
                            type="email"
                            className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </label>
                    <button className="btn-primary w-full" type="submit" disabled={loading}>
                        {loading ? t('sending') : t('sendReset')}
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
