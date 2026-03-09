'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
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
};

export default function ChatLayout({ currentUser }: ChatLayoutProps) {
    const [started, setStarted] = useState(false);
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
        const [employeesRes, chatsRes] = await Promise.all([
            api.get<ChatEmployee[]>('/chat/employees', { params: search ? { search } : {} }),
            api.get<ChatEmployee[]>('/chat/chats'),
        ]);

        const unreadMap = new Map(chatsRes.data.map((e) => [e.id, e.unreadCount || 0]));
        setEmployees(
            employeesRes.data.map((employee) => ({
                ...employee,
                unreadCount: unreadMap.get(employee.id) ?? 0,
            })),
        );
    }, [search]);

    useEffect(() => {
        if (!started) return;
        loadEmployees();
    }, [loadEmployees, started]);

    const openConversation = async (employee: ChatEmployee) => {
        setSelectedEmployee(employee);
        const res = await api.get<ChatMessage[]>(`/chat/conversation/${employee.id}`);
        setMessages(res.data);
        await api.patch(`/chat/messages/read/${employee.id}`);
        setEmployees((prev) => prev.map((emp) => (emp.id === employee.id ? { ...emp, unreadCount: 0 } : emp)));
        getSocket().emit('message_read', { readerId: currentUser.id, senderId: employee.id });
    };

    const sendMessage = async (messageText: string) => {
        if (!selectedEmployee) return;
        getSocket().emit('send_message', {
            senderId: currentUser.id,
            receiverId: selectedEmployee.id,
            messageText,
        });
    };

    const branchLabel = useMemo(() => {
        if (currentUser.governorate === 'ALEXANDRIA') return 'Alexandria';
        if (currentUser.governorate === 'CAIRO') return 'Cairo';
        return 'N/A';
    }, [currentUser.governorate]);

    if (!started) {
        return (
            <section className="card mx-4 p-6 sm:mx-6">
                <h2 className="text-xl font-semibold">Welcome {currentUser.fullName}</h2>
                <p className="mt-1 text-slate-600">Position: {currentUser.role}</p>
                <p className="text-slate-600">Branch: {branchLabel}</p>
                <button className="btn-primary mt-4" onClick={() => setStarted(true)}>Start Chat</button>
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
