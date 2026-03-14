'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const detectIos = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const iOSDevice = /iPad|iPhone|iPod/i.test(ua);
    const iPadOs = ua.includes('Mac') && (navigator as any).maxTouchPoints > 1;
    return iOSDevice || iPadOs;
};

const detectStandalone = () => {
    if (typeof window === 'undefined') return false;
    const displayMode = window.matchMedia?.('(display-mode: standalone)').matches;
    const iosStandalone = (window.navigator as any).standalone;
    return Boolean(displayMode || iosStandalone);
};

export default function PwaInstallButton({ enabled }: { enabled: boolean }) {
    const t = useTranslations('nav');
    const [isIos, setIsIos] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        setIsIos(detectIos());
        setIsInstalled(detectStandalone());

        if (!enabled) {
            return;
        }

        const handleInstalled = () => {
            setIsInstalled(true);
        };

        window.addEventListener('appinstalled', handleInstalled);
        return () => {
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, [enabled]);

    if (isInstalled) return null;
    if (!enabled) return null;

    if (isIos) {
        return <span className="text-xs text-ink/60 sm:text-sm">{t('installIosHint')}</span>;
    }
    return null;
}
