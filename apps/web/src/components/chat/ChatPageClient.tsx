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
        <main className="pb-12">
            <ChatLayout currentUser={user} locale={locale} />
        </main>
    );
}
