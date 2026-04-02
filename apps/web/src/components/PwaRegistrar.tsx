'use client';

import { useEffect } from 'react';

const unregisterAllServiceWorkers = async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
};

export default function PwaRegistrar() {
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') return;
        if (typeof window === 'undefined') return;
        if (!('serviceWorker' in navigator)) return;

        const disabled = process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER === '1';
        if (!disabled) {
            return;
        }

        unregisterAllServiceWorkers().catch(() => {
            // ignore unregister/cleanup failures during recovery
        });
    }, []);

    return null;
}
