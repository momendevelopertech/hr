'use client';

import { ChatMessage } from './types';

export default function MessageBubble({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
    return (
        <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isMine ? 'bg-ink text-white' : 'bg-white border border-ink/10'}`}>
                <p>{message.messageText}</p>
                <p className={`mt-1 text-[11px] ${isMine ? 'text-slate-200' : 'text-slate-500'}`}>
                    {new Date(message.createdAt).toLocaleString()}
                </p>
            </div>
        </div>
    );
}
