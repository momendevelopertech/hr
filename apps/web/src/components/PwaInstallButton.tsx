'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
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
    const [isIos, setIsIos] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        setIsIos(detectIos());
        setIsInstalled(detectStandalone());

        const onBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);
        };

        const onInstalled = () => {
            setIsInstalled(true);
            setInstallPrompt(null);
        };

        const onVisibility = () => {
            setIsInstalled(detectStandalone());
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
        window.addEventListener('appinstalled', onInstalled);
        window.addEventListener('visibilitychange', onVisibility);

        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
            window.removeEventListener('appinstalled', onInstalled);
            window.removeEventListener('visibilitychange', onVisibility);
        };
    }, [enabled]);

    const installLabel = useMemo(() => (installing ? t('installingApp') : t('installApp')), [installing, t]);

    if (!enabled) return null;

    if (isInstalled) {
        return (
            <button
                className="btn-outline text-xs"
                type="button"
                onClick={() => {
                    window.location.assign('/');
                }}
            >
                <ExternalLink size={14} />
                {t('openApp')}
            </button>
        );
    }

    if (isIos) {
        return <span className="text-xs text-ink/60 sm:text-sm">{t('installIosHint')}</span>;
    }

    return (
        <button
            className="btn-outline text-xs"
            type="button"
            disabled={installing || !installPrompt}
            title={!installPrompt ? t('installUnavailable') : undefined}
            onClick={async () => {
                if (!installPrompt) return;
                setInstalling(true);
                await installPrompt.prompt();
                const result = await installPrompt.userChoice;
                setInstalling(false);
                if (result.outcome === 'accepted') {
                    setIsInstalled(true);
                    setInstallPrompt(null);
                }
            }}
        >
            <Download size={14} />
            {installLabel}
        </button>
    );
}
