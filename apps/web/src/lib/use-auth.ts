'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export function useRequireAuth(locale: string) {
    const router = useRouter();
    const { user, bootstrapped, setUser, setLoading, setBootstrapped } = useAuthStore();
    const [ready, setReady] = useState(false);
    const attemptedRef = useRef(false);

    useEffect(() => {
        const hasRequiredProfile = !!(user?.jobTitle && user?.governorate && user?.branchId);
        if (bootstrapped && user && hasRequiredProfile) {
            setReady(true);
            setLoading(false);
            return;
        }

        if (attemptedRef.current) return;
        attemptedRef.current = true;

        let active = true;
        const boot = async () => {
            try {
                await api.get('/auth/csrf');
                const res = await api.get('/auth/me');
                if (!active) return;
                setUser(res.data);
                setBootstrapped(true);
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
    }, [bootstrapped, locale, router, setBootstrapped, setLoading, setUser, user]);

    return { user, ready };
}
