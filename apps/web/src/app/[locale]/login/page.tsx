'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import BrandLogo from '@/components/BrandLogo';
import { Eye, EyeOff } from 'lucide-react';
import { AppApiError } from '@/lib/api';

export default function LoginPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    const t = useTranslations('auth');
    const router = useRouter();
    const { setUser } = useAuthStore();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ identifier?: string; password?: string; form?: string }>({});

    const validate = () => {
        const nextErrors: { identifier?: string; password?: string } = {};
        if (!identifier.trim()) {
            nextErrors.identifier = params.locale === 'ar' ? 'يرجى إدخال البريد الإلكتروني أو اسم المستخدم' : 'Please enter your email or username';
        }
        if (!password.trim()) {
            nextErrors.password = params.locale === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Please enter your password';
        } else if (password.trim().length < 6) {
            nextErrors.password = params.locale === 'ar' ? 'كلمة المرور قصيرة جدًا' : 'Password must be at least 6 characters';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading || !validate()) return;
        setLoading(true);
        setErrors({});
        try {
            await api.get('/auth/csrf');
            const res = await api.post('/auth/login', { identifier: identifier.trim(), password, rememberMe });
            setUser(res.data.user);
            router.push(`/${params.locale}`);
        } catch (error) {
            const err = error as AppApiError;
            setErrors({ form: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6">
            <div className="card w-full max-w-md p-5 sm:p-8">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex justify-center">
                        <BrandLogo locale={params.locale} />
                    </div>
                    <h1 className="text-xl font-semibold sm:text-2xl">{t('welcome')}</h1>
                    <p className="text-sm text-ink/60">{t('changePassword')}</p>
                </div>
                <form onSubmit={submit} className="space-y-4">
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
                    <button className="btn-primary w-full" type="submit" disabled={loading}>
                        {loading ? (params.locale === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing in...') : t('login')}
                    </button>
                    {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
                </form>
            </div>
        </div>
    );
}
