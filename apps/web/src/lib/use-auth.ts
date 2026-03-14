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
    const verifiedRef = useRef(false);

    useEffect(() => {
        const loggedOut = typeof window !== 'undefined' && window.sessionStorage.getItem('sphinx-logged-out') === '1';

        if (!user || !bootstrapped) {
            verifiedRef.current = false;
        }

        if (!user) {
            setReady(false);
            if (loggedOut) {
                setLoading(false);
                router.push(`/${locale}/login`);
                return;
            }
        }

        const hasRequiredProfile = !!(user?.jobTitle && user?.governorate && user?.branchId);
        if (bootstrapped && user && hasRequiredProfile && verifiedRef.current) {
            setReady(true);
            setLoading(false);
            return;
        }

        if (attemptedRef.current) return;
        attemptedRef.current = true;

        let active = true;
        const boot = async () => {
            try {
                if (loggedOut) {
                    router.push(`/${locale}/login`);
                    return;
                }
                await api.get('/auth/csrf');
                if (bootstrapped && user && hasRequiredProfile) {
                    await api.post('/auth/refresh', {});
                    if (!active) return;
                    if (typeof window !== 'undefined') {
                        window.sessionStorage.removeItem('sphinx-logged-out');
                    }
                    verifiedRef.current = true;
                    setReady(true);
                    return;
                }

                const res = await api.get('/auth/me');
                if (!active) return;
                if (typeof window !== 'undefined') {
                    window.sessionStorage.removeItem('sphinx-logged-out');
                }
                setUser(res.data);
                setBootstrapped(true);
                verifiedRef.current = true;
                setReady(true);
            } catch {
                if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem('sphinx-logged-out', '1');
                }
                setUser(null);
                setBootstrapped(false);
                verifiedRef.current = false;
                router.push(`/${locale}/login`);
            } finally {
                if (active) {
                    setLoading(false);
                }
                attemptedRef.current = false;
            }
        };
        setLoading(true);
        boot();
        return () => {
            active = false;
            attemptedRef.current = false;
        };
    }, [bootstrapped, locale, router, setBootstrapped, setLoading, setUser, user]);

    return { user, ready };
}
