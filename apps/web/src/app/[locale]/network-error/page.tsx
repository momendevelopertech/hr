import ErrorState from '@/components/ErrorState';

export default function NetworkErrorPage({ params }: { params: { locale: string } }) {
    return (
        <ErrorState
            title="Network issue"
            description="We cannot reach the server right now. Check your connection and retry."
            ctaHref={`/${params.locale}`}
            ctaLabel="Back to Dashboard"
        />
    );
}
