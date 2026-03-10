'use client';

import { ChatMessage } from './types';

export default function MessageBubble({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
    return (
        <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm md:max-w-[72%] ${
                    isMine ? 'bg-ink text-white' : 'border border-ink/10 bg-white'
                }`}
            >
                <p className="whitespace-pre-wrap break-words">{message.messageText}</p>
                <p className={`mt-1 text-[11px] ${isMine ? 'text-slate-200' : 'text-slate-500'}`}>
                    {new Date(message.createdAt).toLocaleString()}
                </p>
            </div>
        </div>
    );
}
