'use client';

import { ReactNode } from 'react';
import TopNav from './TopNav';
import NavLinks from './NavLinks';

export default function AppShell({ locale, children }: { locale: string; children: ReactNode }) {
    return (
        <div className="min-h-screen">
            <TopNav locale={locale} />
            <NavLinks locale={locale} />
            {children}
        </div>
    );
}
