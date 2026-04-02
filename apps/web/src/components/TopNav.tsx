'use client';

import Image from 'next/image';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function TopNav({
    locale,
    collapsed,
    onToggle,
    showToggle = true,
}: {
    locale: string;
    collapsed: boolean;
    onToggle: () => void;
    showToggle?: boolean;
}) {
    const isAr = locale === 'ar';
    const CollapseIcon = collapsed
        ? (isAr ? ChevronsLeft : ChevronsRight)
        : (isAr ? ChevronsRight : ChevronsLeft);
    const toggleLabel = collapsed
        ? (isAr ? 'فتح الشريط الجانبي' : 'Expand sidebar')
        : (isAr ? 'إغلاق الشريط الجانبي' : 'Collapse sidebar');

    return (
        <div className="sidebar-top">
            <div className="sidebar-brand">
                <div className="sidebar-brand-logos">
                    <div className="sidebar-brand-full">
                        <BrandLogo locale={locale} compact />
                    </div>
                    <div className="sidebar-brand-compact">
                        <Image
                            src="/brand/sphinx-head.svg"
                            alt="SPHINX"
                            width={36}
                            height={36}
                            className="brand-favicon brand-logo"
                            priority
                        />
                    </div>
                </div>
                {showToggle && (
                    <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={toggleLabel} title={toggleLabel}>
                        <CollapseIcon size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}
