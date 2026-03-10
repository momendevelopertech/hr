import ErrorState from '@/components/ErrorState';

export default function ForbiddenPage({ params }: { params: { locale: string } }) {
    return (
        <ErrorState
            title="Forbidden"
            description="You do not have permission to view this resource."
            ctaHref={`/${params.locale}`}
            ctaLabel="Back to Dashboard"
        />
    );
}
