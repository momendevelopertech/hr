'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRequireAuth } from '@/lib/use-auth';
import ChatLayout from '@/components/chat/ChatLayout';
import PageLoader from '@/components/PageLoader';

export default function SupportChatPageClient({ locale }: { locale: string }) {
    const { user, ready } = useRequireAuth(locale);
    const t = useTranslations('chat');

    const roleFilter = useMemo(() => {
        if (!user) return undefined;
        return user.role === 'SUPPORT' ? 'EMPLOYEE' : 'SUPPORT';
    }, [user]);

    if (!ready || !user) {
        return <PageLoader text={t('supportLoading')} />;
    }

    return (
        <ChatLayout
            currentUser={{
                id: user.id,
                fullName: user.fullName,
                governorate: user.governorate,
                role: user.role,
            }}
            locale={locale}
            roleFilter={roleFilter}
            autoStart
            autoSelectFirst
        />
    );
}
