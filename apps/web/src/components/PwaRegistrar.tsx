'use client';

import { useEffect } from 'react';

export default function PwaRegistrar() {
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') return;
        if (typeof window === 'undefined') return;
        if (!('serviceWorker' in navigator)) return;

        const disabled = process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER === '1';
        if (!disabled) {
            return;
        }

        navigator.serviceWorker
            .getRegistrations()
            .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
            .catch(() => {
                // ignore unregister failures while debugging auth incidents
            });
    }, []);

    return null;
}
