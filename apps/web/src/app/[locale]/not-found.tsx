import ErrorState from '@/components/ErrorState';

export default function NotFound({ params }: { params: { locale: string } }) {
    return (
        <ErrorState
            title="Page not found"
            description="The page you are looking for does not exist or was moved."
            ctaHref={`/${params.locale}`}
            ctaLabel="Back to Dashboard"
        />
    );
}
