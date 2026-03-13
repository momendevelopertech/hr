'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
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
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
    const canViewReports = isAdmin || user?.role === 'MANAGER' || user?.role === 'BRANCH_SECRETARY';
    const canManageEmployees = isAdmin || user?.role === 'MANAGER' || user?.role === 'BRANCH_SECRETARY';
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [unreadChats, setUnreadChats] = useState(0);

    const fetchCounts = useCallback(async () => {
        if (!user) return;
        const [notificationsRes, chatsRes] = await Promise.all([
            api.get('/notifications/unread', { headers: { 'x-no-cache': '1' } }),
            api.get('/chat/chats', { headers: { 'x-no-cache': '1' } }),
        ]);
        setUnreadNotifications((notificationsRes.data || []).length);
        const totalUnread = (chatsRes.data || []).reduce((sum: number, chat: any) => sum + (chat.unreadCount || 0), 0);
        setUnreadChats(totalUnread);
    }, [user]);

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

    const links = [
        { href: `/${locale}`, label: t('dashboard'), icon: LayoutDashboard },
        { href: `/${locale}/requests`, label: t('requests'), icon: ClipboardList },
        { href: `/${locale}/chat`, label: t('chat'), badge: unreadChats, icon: MessageCircle },
        ...(canManageEmployees ? [{ href: `/${locale}/employees`, label: t('employees'), icon: Users }] : []),
        ...(isAdmin
            ? [
                { href: `/${locale}/departments`, label: t('departments'), icon: Building2 },
                { href: `/${locale}/forms`, label: t('forms'), icon: FileText },
            ]
            : []),
        ...(canViewReports ? [{ href: `/${locale}/reports`, label: t('reports'), icon: BarChart3 }] : []),
        ...(isAdmin ? [{ href: `/${locale}/settings`, label: t('settings'), icon: Settings }] : []),
        { href: `/${locale}/notifications`, label: t('notifications'), badge: unreadNotifications, icon: Bell },
    ];

    return (
        <nav className="flex flex-wrap gap-2 px-4 pb-4 sm:px-6">
            {links.map((link) => {
                const active = pathname === link.href;
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`btn-outline ${active ? 'bg-ink/10' : ''}`}
                    >
                        <span className="inline-flex items-center gap-2">
                            {link.icon && <link.icon size={16} />}
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
