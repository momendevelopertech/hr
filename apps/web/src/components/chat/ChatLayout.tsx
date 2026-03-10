'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

    useEffect(() => {
        const socket = getSocket();
        socket.emit('join_user_room', { employeeId: currentUser.id });

        const onReceive = (message: ChatMessage) => {
            const isForCurrentConversation =
                selectedEmployee &&
                ((message.senderId === selectedEmployee.id && message.receiverId === currentUser.id) ||
                    (message.senderId === currentUser.id && message.receiverId === selectedEmployee.id));

            if (isForCurrentConversation) {
                setMessages((prev) => [...prev, message]);
                if (message.senderId === selectedEmployee?.id) {
                    socket.emit('message_read', { readerId: currentUser.id, senderId: selectedEmployee.id });
                }
            }

            if (message.receiverId === currentUser.id) {
                setEmployees((prev) => prev.map((emp) => (
                    emp.id === message.senderId
                        ? { ...emp, unreadCount: (emp.unreadCount || 0) + (selectedEmployee?.id === emp.id ? 0 : 1) }
                        : emp
                )));
            }
        };

        socket.on('receive_message', onReceive);

        return () => {
            socket.off('receive_message', onReceive);
        };
    }, [currentUser.id, selectedEmployee]);

    const loadEmployees = useCallback(async () => {
        const params = {
            ...(search ? { search } : {}),
            ...(roleFilter ? { role: roleFilter } : {}),
        };
        const [employeesRes, chatsRes] = await Promise.all([
            api.get<ChatEmployee[]>('/chat/employees', { params }),
            api.get<ChatEmployee[]>('/chat/chats', { params: roleFilter ? { role: roleFilter } : {} }),
        ]);

        const unreadMap = new Map(chatsRes.data.map((e) => [e.id, e.unreadCount || 0]));
        setEmployees(
            employeesRes.data.map((employee) => ({
                ...employee,
                unreadCount: unreadMap.get(employee.id) ?? 0,
            })),
        );
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
        loadEmployees();
    }, [loadEmployees, started]);

    useEffect(() => {
        if (!autoSelectFirst || !started || selectedEmployee || employees.length === 0) return;
        openConversation(employees[0]);
    }, [autoSelectFirst, employees, openConversation, selectedEmployee, started]);

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
