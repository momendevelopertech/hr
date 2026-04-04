'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api, { isAuthError } from '@/lib/api';
import { usePusherChannel } from '@/lib/use-pusher-channel';
import { useAuthStore } from '@/stores/auth-store';
import {
    Bell,
    Building2,
    ClipboardList,
    FileText,
    LayoutDashboard,
    MessageCircle,
    Settings,
    Users,
    BarChart3,
} from 'lucide-react';

export default function NavLinks({ locale, collapsed = false }: { locale: string; collapsed?: boolean }) {
    const t = useTranslations('nav');
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading, bootstrapped } = useAuthStore();
    const isAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
    const canViewReports = isAdmin || user?.role === 'MANAGER' || user?.role === 'BRANCH_SECRETARY';
    const canManageEmployees = isAdmin || user?.role === 'MANAGER' || user?.role === 'BRANCH_SECRETARY';
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [unreadChats, setUnreadChats] = useState(0);
    const authReady = bootstrapped && !loading && !!user;
    const countsInFlight = useRef(false);
    const backgroundConfig = useMemo(() => ({
        headers: {
            'x-skip-activity': '1',
            'x-no-cache': '1',
        },
    }), []);

    const fetchCounts = useCallback(async () => {
        if (!user || countsInFlight.current) return;
        countsInFlight.current = true;
        try {
            const [notificationsRes, chatsRes] = await Promise.all([
                api.get('/notifications/unread', backgroundConfig),
                api.get('/chat/chats', backgroundConfig),
            ]);
            setUnreadNotifications((notificationsRes.data || []).length);
            const totalUnread = (chatsRes.data || []).reduce((sum: number, chat: any) => sum + (chat.unreadCount || 0), 0);
            setUnreadChats(totalUnread);
        } catch (error) {
            if (isAuthError(error)) return;
        } finally {
            countsInFlight.current = false;
        }
    }, [backgroundConfig, user]);

    useEffect(() => {
        if (!user) return;
        fetchCounts();
    }, [fetchCounts, user]);

    const pusherHandlers = useMemo(
        () => ({
            notification: () => fetchCounts(),
            message_read: () => fetchCounts(),
            receive_message: (message: any) => {
                if (message?.receiverId === user?.id) fetchCounts();
            },
        }),
        [fetchCounts, user?.id],
    );

    usePusherChannel(user ? `user-${user.id}` : null, pusherHandlers);

    const links = useMemo(() => [
        { href: `/${locale}`, label: t('dashboard'), icon: LayoutDashboard, tone: 'dashboard' },
        { href: `/${locale}/requests`, label: t('requests'), icon: ClipboardList, tone: 'requests' },
        { href: `/${locale}/chat`, label: t('chat'), badge: unreadChats, icon: MessageCircle, tone: 'chat' },
        ...(canManageEmployees ? [{ href: `/${locale}/employees`, label: t('employees'), icon: Users, tone: 'employees' }] : []),
        ...(isAdmin
            ? [
                { href: `/${locale}/departments`, label: t('departments'), icon: Building2, tone: 'departments' },
                { href: `/${locale}/forms`, label: t('forms'), icon: FileText, tone: 'forms' },
            ]
            : []),
        ...(canViewReports ? [{ href: `/${locale}/reports`, label: t('reports'), icon: BarChart3, tone: 'reports' }] : []),
        ...(isAdmin ? [{ href: `/${locale}/settings`, label: t('settings'), icon: Settings, tone: 'settings' }] : []),
        { href: `/${locale}/notifications`, label: t('notifications'), badge: unreadNotifications, icon: Bell, tone: 'notifications' },
    ], [
        canManageEmployees,
        isAdmin,
        canViewReports,
        locale,
        t,
        unreadChats,
        unreadNotifications,
    ]);


    useEffect(() => {
        if (!authReady) return;
        links.forEach((link) => {
            router.prefetch(link.href);
        });
    }, [authReady, links, router]);

    if (!authReady) {
        return (
            <nav className={`nav-scroll${collapsed ? ' is-collapsed' : ''}`} aria-busy="true">
                {Array.from({ length: 7 }).map((_, index) => (
                    <div
                        key={`nav-skeleton-${index}`}
                        className="h-8 rounded-lg bg-ink/5 animate-pulse my-1"
                    />
                ))}
            </nav>
        );
    }

    return (
        <nav className={`nav-scroll${collapsed ? ' is-collapsed' : ''}`}>
            <div className="nav-section-label">{locale === 'ar' ? 'القائمة' : 'Navigation'}</div>
            {links.map((link) => {
                const isRoot = link.href === `/${locale}`;
                const active = isRoot
                    ? pathname === link.href
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);
                const label = link.label;
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`nav-item ${active ? 'active' : ''}${collapsed ? ' is-collapsed' : ''}`}
                        title={collapsed ? label : undefined}
                        aria-label={collapsed ? label : undefined}
                    >
                        {link.icon && <link.icon size={14} className={`nav-ic nav-icon--${link.tone || 'settings'}`} />}
                        <span className="nav-text">{label}</span>
                        {!!link.badge && (
                            <span className="nb">
                                {link.badge}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
