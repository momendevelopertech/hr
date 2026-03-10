'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function MessageInput({ onSend }: { onSend: (message: string) => Promise<void> }) {
    const t = useTranslations('chat');
    const [message, setMessage] = useState('');

    const submit = async () => {
        const text = message.trim();
        if (!text) return;
        setMessage('');
        await onSend(text);
    };

    return (
        <div className="flex gap-2 border-t border-ink/10 p-3">
            <input
                className="flex-1 rounded-xl border border-ink/20 bg-white px-3 py-2"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                }}
                placeholder={t('messagePlaceholder')}
            />
            <button className="btn-primary" onClick={submit}>{t('send')}</button>
        </div>
    );
}
