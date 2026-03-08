'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function LoginPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    const t = useTranslations('auth');
    const router = useRouter();
    const { setUser } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.get('/auth/csrf');
            const res = await api.post('/auth/login', { email, password });
            setUser(res.data.user);
            router.push(`/${params.locale}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="card w-full max-w-md p-8">
                <div className="mb-6">
                    <p className="text-xs uppercase tracking-[0.3em] text-ink/50">SPHINX HR</p>
                    <h1 className="text-2xl font-semibold">{t('welcome')}</h1>
                    <p className="text-sm text-ink/60">{t('changePassword')}</p>
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
                    <label className="text-sm">
                        {t('password')}
                        <input
                            type="password"
                            className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </label>
                    <button className="btn-primary w-full" type="submit" disabled={loading}>
                        {loading ? '...' : t('login')}
                    </button>
                </form>
            </div>
        </div>
    );
}
