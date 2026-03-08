import AppShell from '@/components/AppShell';
import DepartmentsClient from '@/components/DepartmentsClient';

export default function DepartmentsPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    return (
        <AppShell locale={params.locale}>
            <DepartmentsClient locale={params.locale} />
        </AppShell>
    );
}
