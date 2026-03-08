'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export function useRequireAuth(locale: string) {
    const router = useRouter();
    const { user, setUser, setLoading } = useAuthStore();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let active = true;
        const boot = async () => {
            try {
                await api.get('/auth/csrf');
                const res = await api.get('/auth/me');
                if (!active) return;
                setUser(res.data);
                setReady(true);
            } catch {
                router.push(`/${locale}/login`);
            } finally {
                setLoading(false);
            }
        };
        setLoading(true);
        boot();
        return () => {
            active = false;
        };
    }, []);

    return { user, ready };
}
