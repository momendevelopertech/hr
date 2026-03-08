import DashboardClient from '@/components/DashboardClient';
import AppShell from '@/components/AppShell';

export default function DashboardPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    return (
        <AppShell locale={params.locale}>
            <DashboardClient locale={params.locale} />
        </AppShell>
    );
}
