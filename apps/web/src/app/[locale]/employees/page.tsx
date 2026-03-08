import AppShell from '@/components/AppShell';
import EmployeesClient from '@/components/EmployeesClient';

export default function EmployeesPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    return (
        <AppShell locale={params.locale}>
            <EmployeesClient locale={params.locale} />
        </AppShell>
    );
}
