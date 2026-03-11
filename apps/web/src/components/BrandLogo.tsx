'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function BrandLogo({
    locale,
    compact = false,
}: {
    locale: string;
    compact?: boolean;
}) {
    const intrinsicWidth = 280;
    const intrinsicHeight = 112;
    const widthClass = compact ? 'w-[140px] sm:w-[170px]' : 'w-[200px] sm:w-[280px]';

    return (
        <Link href={`/${locale}`} className={`inline-flex items-center ${widthClass}`} aria-label="SPHINX Home">
            <Image
                src="/brand/sphinx-logo.svg"
                alt="SPHINX Logo"
                width={intrinsicWidth}
                height={intrinsicHeight}
                className="brand-logo h-auto w-full"
                priority
            />
        </Link>
    );
}
