import AppShell from '@/components/AppShell';
import ChatPageClient from '@/components/chat/ChatPageClient';

export default function ChatPage({ params }: { params: { locale: string } }) {
    return (
        <AppShell locale={params.locale}>
            <ChatPageClient locale={params.locale} />
        </AppShell>
    );
}
