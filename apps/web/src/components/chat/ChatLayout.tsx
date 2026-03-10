'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { enumLabels } from '@/lib/enum-labels';
import EmployeeList from './EmployeeList';
import ChatWindow from './ChatWindow';
import { ChatEmployee, ChatMessage } from './types';

type ChatLayoutProps = {
    currentUser: {
        id: string;
        fullName: string;
        governorate?: 'CAIRO' | 'ALEXANDRIA' | null;
        role: string;
    };
    locale: string;
    roleFilter?: string;
    autoStart?: boolean;
    autoSelectFirst?: boolean;
};

export default function ChatLayout({ currentUser, locale, roleFilter, autoStart, autoSelectFirst }: ChatLayoutProps) {
    const t = useTranslations('chat');
    const [started, setStarted] = useState(!!autoStart);
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
        getSocket().emit('message_read', { readerId: currentUser.id, senderId: employee.id });
    }, [currentUser.id]);

    useEffect(() => {
        if (!started) return;
        if (search.trim()) {
            loadEmployees();
            return;
        }
        loadChats();
    }, [loadChats, loadEmployees, search, started]);

    useEffect(() => {
        if (!autoSelectFirst || !started || selectedEmployee || employees.length === 0) return;
        openConversation(employees[0]);
    }, [autoSelectFirst, employees, openConversation, selectedEmployee, started]);

    useEffect(() => {
        const socket = getSocket();
        socket.emit('join_user_room', { employeeId: currentUser.id });

        const onReceive = (message: ChatMessage) => {
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
                    socket.emit('message_read', { readerId: currentUser.id, senderId: active.id });
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
        };

        socket.on('receive_message', onReceive);

        return () => {
            socket.off('receive_message', onReceive);
        };
    }, [currentUser.id, loadChats]);

    const sendMessage = async (messageText: string) => {
        if (!selectedEmployee) return;
        getSocket().emit('send_message', {
            senderId: currentUser.id,
            receiverId: selectedEmployee.id,
            messageText,
        });
    };

    const branchLabel = useMemo(() => {
        if (currentUser.governorate === 'ALEXANDRIA') return t('branchAlexandria');
        if (currentUser.governorate === 'CAIRO') return t('branchCairo');
        return t('notAvailable');
    }, [currentUser.governorate, t]);

    if (!started) {
        return (
            <section className="card mx-4 p-6 sm:mx-6">
                <h2 className="text-xl font-semibold">{t('welcome', { name: currentUser.fullName })}</h2>
                <p className="mt-1 text-slate-600">{t('position')}: {enumLabels.role(currentUser.role, locale as 'en' | 'ar')}</p>
                <p className="text-slate-600">{t('branch')}: {branchLabel}</p>
                <button className="btn-primary mt-4" onClick={() => setStarted(true)}>{t('start')}</button>
            </section>
        );
    }

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
                selectedEmployee={selectedEmployee}
                messages={messages}
                onSend={sendMessage}
            />
        </section>
    );
}
