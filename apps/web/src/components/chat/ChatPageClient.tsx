'use client';

import { useRequireAuth } from '@/lib/use-auth';
import PageLoader from '@/components/PageLoader';
import ChatLayout from './ChatLayout';

export default function ChatPageClient({ locale }: { locale: string }) {
    const { user, ready } = useRequireAuth(locale);

    if (!ready || !user) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل المحادثات...' : 'Loading chat...'} />;
    }

    return (
        <main className="pb-12">
            <ChatLayout currentUser={user} />
        </main>
    );
}
