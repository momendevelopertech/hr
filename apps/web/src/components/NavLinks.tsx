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

export default function NavLinks({ locale }: { locale: string }) {
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
            'x-allow-cache': '1',
            'x-skip-activity': '1',
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
            receive_message: (message: any) => {
                if (message?.receiverId === user?.id) fetchCounts();
            },
        }),
        [fetchCounts, user?.id],
    );

    usePusherChannel(user ? `user-${user.id}` : null, pusherHandlers);

    const links = useMemo(() => [
        { href: `/${locale}`, label: t('dashboard'), icon: LayoutDashboard, iconClass: 'nav-icon nav-icon--dashboard' },
        { href: `/${locale}/requests`, label: t('requests'), icon: ClipboardList, iconClass: 'nav-icon nav-icon--requests' },
        { href: `/${locale}/chat`, label: t('chat'), badge: unreadChats, icon: MessageCircle, iconClass: 'nav-icon nav-icon--chat' },
        ...(canManageEmployees ? [{ href: `/${locale}/employees`, label: t('employees'), icon: Users, iconClass: 'nav-icon nav-icon--employees' }] : []),
        ...(isAdmin
            ? [
                { href: `/${locale}/departments`, label: t('departments'), icon: Building2, iconClass: 'nav-icon nav-icon--departments' },
                { href: `/${locale}/forms`, label: t('forms'), icon: FileText, iconClass: 'nav-icon nav-icon--forms' },
            ]
            : []),
        ...(canViewReports ? [{ href: `/${locale}/reports`, label: t('reports'), icon: BarChart3, iconClass: 'nav-icon nav-icon--reports' }] : []),
        ...(isAdmin ? [{ href: `/${locale}/settings`, label: t('settings'), icon: Settings, iconClass: 'nav-icon nav-icon--settings' }] : []),
        { href: `/${locale}/notifications`, label: t('notifications'), badge: unreadNotifications, icon: Bell, iconClass: 'nav-icon nav-icon--notifications' },
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
            <nav className="flex flex-wrap gap-2 px-4 pb-4 sm:px-6" aria-busy="true">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={`nav-skeleton-${index}`}
                        className="h-10 w-28 rounded-xl bg-ink/5 animate-pulse"
                    />
                ))}
            </nav>
        );
    }

    return (
        <nav className="flex flex-wrap gap-2 px-4 pb-4 sm:px-6">
            {links.map((link) => {
                const isRoot = link.href === `/${locale}`;
                const active = isRoot
                    ? pathname === link.href
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`btn-outline ${active ? 'bg-ink/10' : ''}`}
                    >
                        <span className="inline-flex items-center gap-2">
                            {link.icon && <link.icon size={16} className={link.iconClass} />}
                            {link.label}
                            {!!link.badge && (
                                <span className="min-w-[20px] rounded-full bg-cactus px-2 py-0.5 text-center text-xs font-semibold text-white">
                                    {link.badge}
                                </span>
                            )}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
