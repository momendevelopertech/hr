'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

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
    const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [isIos, setIsIos] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        setIsIos(detectIos());
        setIsInstalled(detectStandalone());

        const handleBeforeInstall = (event: Event) => {
            event.preventDefault();
            setPromptEvent(event as BeforeInstallPromptEvent);
        };
        const handleInstalled = () => {
            setPromptEvent(null);
            setIsInstalled(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall as EventListener);
        window.addEventListener('appinstalled', handleInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall as EventListener);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, [enabled]);

    if (!enabled || isInstalled) return null;

    if (isIos) {
        return <span className="text-xs text-ink/60 sm:text-sm">{t('installIosHint')}</span>;
    }

    if (!promptEvent) return null;

    const install = async () => {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        setPromptEvent(null);
        if (choice.outcome === 'accepted') {
            setIsInstalled(true);
        }
    };

    return (
        <button className="btn-outline text-xs sm:text-sm" onClick={install}>
            {t('installApp')}
        </button>
    );
}
