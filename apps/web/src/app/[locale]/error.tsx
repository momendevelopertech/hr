'use client';

import ErrorState from '@/components/ErrorState';

export default function Error({ reset }: { reset: () => void }) {
    return (
        <div>
            <ErrorState
                title="Something went wrong"
                description="We could not load this page. Please try again."
                ctaHref="/en"
                ctaLabel="Back to Dashboard"
            />
            <div className="fixed bottom-6 right-6">
                <button className="btn-secondary" onClick={reset}>Retry</button>
            </div>
        </div>
    );
}
