import ErrorState from '@/components/ErrorState';

export default function UnauthorizedPage({ params }: { params: { locale: string } }) {
    return (
        <ErrorState
            title="Unauthorized"
            description="Please sign in to access this page."
            ctaHref={`/${params.locale}/login`}
            ctaLabel="Go to Login"
        />
    );
}
