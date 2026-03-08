import AppShell from '@/components/AppShell';
import RequestsClient from '@/components/RequestsClient';

export default function RequestsPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    return (
        <AppShell locale={params.locale}>
            <RequestsClient locale={params.locale} />
        </AppShell>
    );
}
