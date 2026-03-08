import AppShell from '@/components/AppShell';
import FormsBuilderClient from '@/components/FormsBuilderClient';

export default function FormsPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    return (
        <AppShell locale={params.locale}>
            <FormsBuilderClient locale={params.locale} />
        </AppShell>
    );
}
