'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { usePusherChannel } from '@/lib/use-pusher-channel';
import EmployeeList from './EmployeeList';
import ChatWindow from './ChatWindow';
import { ChatEmployee, ChatMessage } from './types';

type ChatLayoutProps = {
    currentUser: {
        id: string;
        fullName: string;
        fullNameAr?: string | null;
        governorate?: 'CAIRO' | 'ALEXANDRIA' | null;
        role: string;
        department?: { id: string; name: string; nameAr?: string } | null;
        jobTitle?: string | null;
        jobTitleAr?: string | null;
    };
    locale: string;
    roleFilter?: string;
    autoSelectFirst?: boolean;
};

export default function ChatLayout({ currentUser, locale, roleFilter, autoSelectFirst }: ChatLayoutProps) {
    const [employees, setEmployees] = useState<ChatEmployee[]>([]);
    const [search, setSearch] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<ChatEmployee | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const selectedRef = useRef<ChatEmployee | null>(null);

    useEffect(() => {
        selectedRef.current = selectedEmployee;
    }, [selectedEmployee]);

    const loadChats = useCallback(async () => {
        const params = roleFilter ? { role: roleFilter } : {};
        const res = await api.get<ChatEmployee[]>('/chat/chats', { params });
        setEmployees(res.data);
    }, [roleFilter]);

    const loadEmployees = useCallback(async () => {
        const params = {
            ...(search ? { search } : {}),
            ...(roleFilter ? { role: roleFilter } : {}),
        };
        const res = await api.get<ChatEmployee[]>('/chat/employees', { params });
        setEmployees((prev) => {
            const historyMap = new Map(prev.map((item) => [item.id, item]));
            return res.data.map((employee) => ({
                ...historyMap.get(employee.id),
                ...employee,
            }));
        });
    }, [roleFilter, search]);

    const openConversation = useCallback(async (employee: ChatEmployee) => {
        setSelectedEmployee(employee);
        const res = await api.get<ChatMessage[]>(`/chat/conversation/${employee.id}`);
        setMessages(res.data);
        await api.patch(`/chat/messages/read/${employee.id}`);
        setEmployees((prev) => prev.map((emp) => (emp.id === employee.id ? { ...emp, unreadCount: 0 } : emp)));
    }, []);

    useEffect(() => {
        if (search.trim()) {
            loadEmployees();
            return;
        }
        loadChats();
    }, [loadChats, loadEmployees, search]);

    useEffect(() => {
        if (!autoSelectFirst || selectedEmployee || employees.length === 0) return;
        openConversation(employees[0]);
    }, [autoSelectFirst, employees, openConversation, selectedEmployee]);

    const handleIncomingMessage = useCallback((message: ChatMessage) => {
            const active = selectedRef.current;
            const isForCurrentConversation =
                active &&
                ((message.senderId === active.id && message.receiverId === currentUser.id) ||
                    (message.senderId === currentUser.id && message.receiverId === active.id));

            if (isForCurrentConversation) {
                setMessages((prev) => {
                    if (prev.some((item) => item.id === message.id)) return prev;
                    return [...prev, message];
                });
                if (message.senderId === active?.id) {
                    api.patch(`/chat/messages/read/${active.id}`).catch(() => undefined);
                }
            }

            const chatPartnerId = message.senderId === currentUser.id ? message.receiverId : message.senderId;
            setEmployees((prev) => {
                const index = prev.findIndex((emp) => emp.id === chatPartnerId);
                if (index === -1) return prev;

                const next = [...prev];
                const updated = {
                    ...next[index],
                    lastMessage: message.messageText,
                    lastMessageAt: message.createdAt,
                    unreadCount:
                        message.receiverId === currentUser.id && active?.id !== chatPartnerId
                            ? (next[index].unreadCount || 0) + 1
                            : next[index].unreadCount || 0,
                };
                next.splice(index, 1);
                return [updated, ...next];
            });

            if (message.receiverId === currentUser.id) {
                loadChats();
            }
    }, [currentUser.id, loadChats]);

    const pusherHandlers = useMemo(
        () => ({
            receive_message: (message: ChatMessage) => handleIncomingMessage(message),
        }),
        [handleIncomingMessage],
    );

    usePusherChannel(`user-${currentUser.id}`, pusherHandlers);

    const sendMessage = async (messageText: string) => {
        if (!selectedEmployee) return;
        const res = await api.post<ChatMessage>('/chat/messages', {
            receiverId: selectedEmployee.id,
            messageText,
        });
        handleIncomingMessage(res.data);
    };

    return (
        <section className="mx-4 grid rounded-2xl border border-ink/10 bg-white sm:mx-6 md:grid-cols-[320px_1fr]">
            <EmployeeList
                employees={employees}
                selectedId={selectedEmployee?.id}
                onSelect={openConversation}
                search={search}
                setSearch={setSearch}
            />
            <ChatWindow
                currentUserId={currentUser.id}
                currentUser={currentUser}
                locale={locale}
                selectedEmployee={selectedEmployee}
                messages={messages}
                onSend={sendMessage}
            />
        </section>
    );
}
