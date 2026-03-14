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
    const [installUnavailable, setInstallUnavailable] = useState(false);

    useEffect(() => {
        setIsIos(detectIos());
        setIsInstalled(detectStandalone());

        if (!enabled) {
            setPromptEvent(null);
            setInstallUnavailable(false);
            return;
        }

        const handleBeforeInstall = (event: Event) => {
            event.preventDefault();
            setPromptEvent(event as BeforeInstallPromptEvent);
            setInstallUnavailable(false);
        };
        const handleInstalled = () => {
            setPromptEvent(null);
            setIsInstalled(true);
            setInstallUnavailable(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall as EventListener);
        window.addEventListener('appinstalled', handleInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall as EventListener);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled || isIos || isInstalled || promptEvent) return;
        const timer = window.setTimeout(() => {
            setInstallUnavailable(true);
        }, 2500);
        return () => window.clearTimeout(timer);
    }, [enabled, isIos, isInstalled, promptEvent]);

    if (isInstalled) return null;
    if (!enabled) return null;

    if (isIos) {
        return <span className="text-xs text-ink/60 sm:text-sm">{t('installIosHint')}</span>;
    }

    if (!promptEvent) {
        return installUnavailable ? (
            <span className="text-xs text-ink/60 sm:text-sm">{t('installUnavailable')}</span>
        ) : null;
    }

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
