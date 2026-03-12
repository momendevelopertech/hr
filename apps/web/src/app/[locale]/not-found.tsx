'use client';

import { useParams } from 'next/navigation';
import ErrorState from '@/components/ErrorState';

export default function NotFound() {
    const params = useParams();
    const locale = typeof params?.locale === 'string' ? params.locale : 'en';

    return (
        <ErrorState
            title="Page not found"
            description="The page you are looking for does not exist or was moved."
            ctaHref={`/${locale}`}
            ctaLabel="Back to Dashboard"
        />
    );
}
