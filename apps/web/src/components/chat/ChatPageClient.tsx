'use client';

import { useTranslations } from 'next-intl';
import { useRequireAuth } from '@/lib/use-auth';
import PageLoader from '@/components/PageLoader';
import ChatLayout from './ChatLayout';

export default function ChatPageClient({ locale }: { locale: string }) {
    const { user, ready } = useRequireAuth(locale);
    const t = useTranslations('chat');

    if (!ready || !user) {
        return <PageLoader text={t('loading')} />;
    }

    return (
        <main className="h-[calc(100dvh-5.75rem)] min-h-[560px] pb-4 sm:h-[calc(100dvh-6.5rem)] sm:min-h-[620px] sm:pb-6">
            <ChatLayout currentUser={user} locale={locale} />
        </main>
    );
}
