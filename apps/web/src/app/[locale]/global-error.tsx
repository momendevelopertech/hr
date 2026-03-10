'use client';

import ErrorState from '@/components/ErrorState';

export default function GlobalError() {
    return (
        <html>
            <body>
                <ErrorState
                    title="Server error"
                    description="An unexpected error occurred. Our team has been notified."
                    ctaHref="/en"
                    ctaLabel="Back to Dashboard"
                />
            </body>
        </html>
    );
}
