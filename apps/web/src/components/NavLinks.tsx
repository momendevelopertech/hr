'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';

export default function NavLinks({ locale }: { locale: string }) {
    const t = useTranslations('nav');
    const pathname = usePathname();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
    const canManageEmployees = isAdmin || user?.role === 'MANAGER' || user?.role === 'BRANCH_SECRETARY';
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [unreadChats, setUnreadChats] = useState(0);

    const fetchCounts = useCallback(async () => {
        if (!user) return;
        const [notificationsRes, chatsRes] = await Promise.all([
            api.get('/notifications/unread'),
            api.get('/chat/chats'),
        ]);
        setUnreadNotifications((notificationsRes.data || []).length);
        const totalUnread = (chatsRes.data || []).reduce((sum: number, chat: any) => sum + (chat.unreadCount || 0), 0);
        setUnreadChats(totalUnread);
    }, [user]);

    useEffect(() => {
        if (!user) return;
        fetchCounts();
        const socket = getSocket();
        socket.emit('join', user.id);
        const onNotification = () => fetchCounts();
        const onMessage = (message: any) => {
            if (message?.receiverId === user.id) fetchCounts();
        };
        socket.on('notification', onNotification);
        socket.on('receive_message', onMessage);
        return () => {
            socket.off('notification', onNotification);
            socket.off('receive_message', onMessage);
        };
    }, [fetchCounts, user]);

    const links = [
        { href: `/${locale}`, label: t('dashboard') },
        { href: `/${locale}/requests`, label: t('requests') },
        { href: `/${locale}/chat`, label: t('chat'), badge: unreadChats },
        { href: `/${locale}/support`, label: t('support') },
        ...(canManageEmployees ? [{ href: `/${locale}/employees`, label: t('employees') }] : []),
        ...(isAdmin
            ? [
                { href: `/${locale}/departments`, label: t('departments') },
                { href: `/${locale}/forms`, label: t('forms') },
                { href: `/${locale}/reports`, label: t('reports') },
            ]
            : []),
        { href: `/${locale}/notifications`, label: t('notifications'), badge: unreadNotifications },
    ];

    return (
        <nav className="flex flex-wrap gap-2 px-6 pb-4">
            {links.map((link) => {
                const active = pathname === link.href;
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`btn-outline ${active ? 'bg-ink/10' : ''}`}
                    >
                        <span className="inline-flex items-center gap-2">
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
