'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
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
    const [viewportWidth, setViewportWidth] = useState<number | null>(null);
    const sidebarRef = useRef<HTMLElement | null>(null);
    const previousActiveElementRef = useRef<HTMLElement | null>(null);
    const isAr = locale === 'ar';
    const isMobile = viewportWidth !== null && viewportWidth < 768;
    const effectiveCollapsed = !isMobile && sidebarCollapsed;
    const mobileToggleLabel = mobileSidebarOpen
        ? (isAr ? 'إغلاق قائمة التنقل' : 'Close navigation menu')
        : (isAr ? 'فتح قائمة التنقل' : 'Open navigation menu');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const syncViewport = () => setViewportWidth(window.innerWidth);
        syncViewport();
        window.addEventListener('resize', syncViewport);
        const stored = window.localStorage.getItem('sphinx-sidebar-collapsed');
        if (stored !== null) {
            setSidebarCollapsed(stored === '1');
        } else {
            setSidebarCollapsed(window.innerWidth < 1024 && window.innerWidth >= 768);
        }
        return () => window.removeEventListener('resize', syncViewport);
    }, []);

    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!isMobile) {
            setMobileSidebarOpen(false);
        }
    }, [isMobile]);

    useEffect(() => {
        if (!isMobile || !mobileSidebarOpen || !sidebarRef.current) return;
        const sidebar = sidebarRef.current;
        previousActiveElementRef.current = document.activeElement as HTMLElement | null;
        const selectors = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(sidebar.querySelectorAll<HTMLElement>(selectors));
        const firstFocusable = focusables[0];
        const lastFocusable = focusables[focusables.length - 1];
        firstFocusable?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setMobileSidebarOpen(false);
                return;
            }
            if (event.key !== 'Tab' || focusables.length === 0) return;
            if (event.shiftKey && document.activeElement === firstFocusable) {
                event.preventDefault();
                lastFocusable?.focus();
            } else if (!event.shiftKey && document.activeElement === lastFocusable) {
                event.preventDefault();
                firstFocusable?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previousActiveElementRef.current?.focus();
        };
    }, [isMobile, mobileSidebarOpen]);

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
            <aside
                id="app-sidebar"
                ref={sidebarRef}
                className={`app-sidebar ${effectiveCollapsed ? 'is-collapsed' : ''} ${mobileSidebarOpen ? 'is-mobile-open' : ''}`}
                aria-hidden={isMobile ? !mobileSidebarOpen : undefined}
            >
                <TopNav locale={locale} collapsed={effectiveCollapsed} onToggle={toggleSidebar} showToggle={!isMobile} />
                <NavLinks locale={locale} collapsed={effectiveCollapsed} />
                <SidebarFooter locale={locale} collapsed={effectiveCollapsed} />
            </aside>
            {isMobile && mobileSidebarOpen && (
                <button
                    className="mobile-sidebar-backdrop"
                    aria-label={isAr ? 'إغلاق القائمة الجانبية' : 'Close sidebar'}
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}
            <div className="app-main">
                {isMobile && (
                    <button
                        className="mobile-nav-trigger"
                        type="button"
                        onClick={() => setMobileSidebarOpen((value) => !value)}
                        aria-label={mobileToggleLabel}
                        aria-expanded={mobileSidebarOpen}
                        aria-controls="app-sidebar"
                    >
                        {mobileSidebarOpen ? <X size={16} /> : <Menu size={16} />}
                    </button>
                )}
                {children}
            </div>
        </div>
    );
}
