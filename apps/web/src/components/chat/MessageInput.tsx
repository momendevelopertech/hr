'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function MessageInput({ onSend, disabled }: { onSend: (message: string) => Promise<void>; disabled?: boolean }) {
    const t = useTranslations('chat');
    const [message, setMessage] = useState('');

    const submit = async () => {
        const text = message.trim();
        if (!text || disabled) return;
        setMessage('');
        await onSend(text);
    };

    return (
        <div className="flex gap-2 border-t border-ink/10 bg-white p-3">
            <input
                className="flex-1 rounded-xl border border-ink/20 bg-white px-3 py-2"
                value={message}
                disabled={disabled}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                    }
                }}
                placeholder={t('messagePlaceholder')}
            />
            <button className="btn-primary" onClick={submit} disabled={disabled}>{t('send')}</button>
        </div>
    );
}
