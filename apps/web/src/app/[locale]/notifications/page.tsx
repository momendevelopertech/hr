import AppShell from '@/components/AppShell';
import NotificationsClient from '@/components/NotificationsClient';

export default function NotificationsPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    return (
        <AppShell locale={params.locale}>
            <NotificationsClient locale={params.locale} />
        </AppShell>
    );
}
