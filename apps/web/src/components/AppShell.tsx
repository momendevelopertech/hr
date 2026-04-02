'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import TopNav from './TopNav';
import NavLinks from './NavLinks';
import SidebarFooter from './SidebarFooter';

export default function AppShell({ locale, children }: { locale: string; children: ReactNode }) {
    const pathname = usePathname();
    const hideShell = pathname.includes('/requests/print/');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored = window.localStorage.getItem('sphinx-sidebar-collapsed');
        if (stored !== null) {
            setSidebarCollapsed(stored === '1');
        }
    }, []);

    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [pathname]);

    const toggleSidebar = () => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('sphinx-sidebar-collapsed', next ? '1' : '0');
            }
            return next;
        });
    };

    if (hideShell) {
        return <div className="min-h-screen">{children}</div>;
    }

    return (
        <div className="app-shell min-h-screen">
            <aside className={`app-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileSidebarOpen ? 'is-mobile-open' : ''}`}>
                <TopNav locale={locale} collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
                <NavLinks locale={locale} collapsed={sidebarCollapsed} />
                <SidebarFooter locale={locale} collapsed={sidebarCollapsed} />
            </aside>
            {mobileSidebarOpen && <button className="mobile-sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)} />}
            <div className="app-main">
                <button className="mobile-nav-trigger" type="button" onClick={() => setMobileSidebarOpen((value) => !value)} aria-label={mobileSidebarOpen ? 'Close navigation' : 'Open navigation'}>
                    {mobileSidebarOpen ? <X size={16} /> : <Menu size={16} />}
                </button>
                {children}
            </div>
        </div>
    );
}
