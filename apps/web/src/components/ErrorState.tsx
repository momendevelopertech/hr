'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function ErrorState({
    title,
    description,
    ctaHref,
    ctaLabel,
}: {
    title: string;
    description: string;
    ctaHref: string;
    ctaLabel: string;
}) {
    return (
        <div className="min-h-screen bg-atmosphere flex items-center justify-center px-4">
            <div className="card max-w-xl w-full p-8 text-center space-y-5">
                <Image
                    src="/brand/sphinx-logo.svg"
                    alt="SPHINX Logo"
                    width={220}
                    height={88}
                    className="mx-auto"
                    priority
                />
                <h1 className="text-2xl font-semibold text-ink">{title}</h1>
                <p className="text-ink/70">{description}</p>
                <Link className="btn-primary inline-flex" href={ctaHref}>{ctaLabel}</Link>
            </div>
        </div>
    );
}
