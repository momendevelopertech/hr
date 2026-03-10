'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { ChatEmployee, ChatMessage } from './types';

export default function ChatWindow({
    currentUserId,
    selectedEmployee,
    messages,
    onSend,
}: {
    currentUserId: string;
    selectedEmployee: ChatEmployee | null;
    messages: ChatMessage[];
    onSend: (message: string) => Promise<void>;
}) {
    const t = useTranslations('chat');
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!selectedEmployee) {
        return <section className="flex flex-1 items-center justify-center text-slate-500">{t('selectPrompt')}</section>;
    }

    return (
        <section className="flex flex-1 flex-col">
            <header className="border-b border-ink/10 px-4 py-3">
                <h3 className="font-semibold">{selectedEmployee.fullName}</h3>
                <p className="text-xs text-slate-500">{selectedEmployee.jobTitle || t('employeeFallback')}</p>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} isMine={m.senderId === currentUserId} />
                ))}
                <div ref={bottomRef} />
            </div>
            <MessageInput onSend={onSend} />
        </section>
    );
}
