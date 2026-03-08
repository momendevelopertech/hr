import AppShell from '@/components/AppShell';
import ReportsClient from '@/components/ReportsClient';

export default function ReportsPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    return (
        <AppShell locale={params.locale}>
            <ReportsClient locale={params.locale} />
        </AppShell>
    );
}
