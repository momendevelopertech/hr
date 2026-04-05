'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { composeReplyMessage } from './compose-reply';
import { ChatEmployee, ChatMessage } from './types';

export default function ChatWindow({
    currentUserId,
    currentUser,
    locale,
    selectedEmployee,
    messages,
    onSend,
}: {
    currentUserId: string;
    currentUser: {
        fullName: string;
        fullNameAr?: string | null;
        role: string;
        governorate?: 'CAIRO' | 'ALEXANDRIA' | null;
        department?: { id: string; name: string; nameAr?: string } | null;
        jobTitle?: string | null;
        jobTitleAr?: string | null;
    };
    locale: string;
    selectedEmployee: ChatEmployee | null;
    messages: ChatMessage[];
    onSend: (message: string) => Promise<void>;
}) {
    const t = useTranslations('chat');
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const [introducing, setIntroducing] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const branchLabel = useMemo(() => {
        if (!selectedEmployee?.governorate) return t('notAvailable');
        if (selectedEmployee.governorate === 'ALEXANDRIA') return t('branchAlexandria');
        if (selectedEmployee.governorate === 'CAIRO') return t('branchCairo');
        return t('notAvailable');
    }, [selectedEmployee?.governorate, t]);

    const currentBranchLabel = useMemo(() => {
        if (!currentUser?.governorate) return t('notAvailable');
        if (currentUser.governorate === 'ALEXANDRIA') return t('branchAlexandria');
        if (currentUser.governorate === 'CAIRO') return t('branchCairo');
        return t('notAvailable');
    }, [currentUser?.governorate, t]);

    const currentDepartmentLabel = useMemo(() => {
        if (!currentUser?.department) return t('notAvailable');
        return locale === 'ar'
            ? currentUser.department.nameAr || currentUser.department.name
            : currentUser.department.name;
    }, [currentUser?.department, locale, t]);

    const currentPositionLabel = useMemo(() => {
        const title = locale === 'ar'
            ? currentUser?.jobTitleAr || currentUser?.jobTitle
            : currentUser?.jobTitle;
        return title || t('noJobTitle');
    }, [currentUser?.jobTitle, currentUser?.jobTitleAr, locale, t]);

    const currentName = useMemo(
        () => (locale === 'ar' ? currentUser?.fullNameAr || currentUser?.fullName : currentUser?.fullName),
        [currentUser?.fullName, currentUser?.fullNameAr, locale],
    );

    const handleIntroduce = async () => {
        if (!selectedEmployee || introducing) return;
        const introKey = currentUser.role === 'MANAGER'
            ? 'introMessageManager'
            : currentUser.role === 'BRANCH_SECRETARY'
                ? 'introMessageSecretary'
                : currentUser.role === 'HR_ADMIN' || currentUser.role === 'SUPER_ADMIN'
                    ? 'introMessageHr'
                    : 'introMessageDefault';
        setIntroducing(true);
        try {
            const text = t(introKey as any, {
                name: currentName || t('employeeFallback'),
                department: currentDepartmentLabel,
                branch: currentBranchLabel,
                position: currentPositionLabel,
            });
            await onSend(text);
        } finally {
            setIntroducing(false);
        }
    };

    return (
        <section className="flex min-h-0 flex-1 flex-col">
            {selectedEmployee ? (
                <>
                    <header className="chat-thread-header border-b border-[#e9edef] bg-[#f0f2f5] px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfe5e7] text-lg font-bold text-[#54656f]">
                                    {selectedEmployee.fullName.slice(0, 1).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-[16px] font-semibold text-[#111b21]">{selectedEmployee.fullName}</h3>
                                    <p className="text-[12px] text-[#667781]">{selectedEmployee.jobTitle || t('employeeFallback')}</p>
                                </div>
                            </div>
                            <button className="rounded-full border border-[#c4d0d4] bg-white px-3 py-1.5 text-xs font-medium text-[#111b21] hover:bg-[#f0f2f5]" onClick={handleIntroduce} disabled={introducing}>
                                {introducing ? t('sending') : t('introduceYourself')}
                            </button>
                        </div>
                    </header>
                    <div
                        className="chat-thread-body flex-1 space-y-1 overflow-y-auto p-3"
                        style={{
                            backgroundColor: '#e5ddd5',
                            backgroundImage: "linear-gradient(rgba(229,221,213,0.92), rgba(229,221,213,0.92)), url('/brand/sphinx-head.svg')",
                            backgroundSize: '220px',
                            backgroundRepeat: 'repeat',
                        }}
                    >
                        <div className="rounded-lg border border-[#e9edef] bg-white/95 p-3 text-sm text-[#111b21] shadow-sm">
                            <h4 className="text-[15px] font-semibold">{t('welcome', { name: selectedEmployee.fullName })}</h4>
                            <p className="mt-1 text-[13px] text-[#667781]">{t('position')}: {selectedEmployee.jobTitle || t('noJobTitle')}</p>
                            <p className="text-[13px] text-[#667781]">{t('branch')}: {branchLabel}</p>
                        </div>
                        {messages.map((m) => (
                            <MessageBubble
                                key={m.id}
                                message={m}
                                isMine={m.senderId === currentUserId}
                                onReply={(msg) => setReplyTo(msg)}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </div>
                </>
            ) : (
                <div className="flex flex-1 items-center justify-center p-4 text-center text-[#667781]">{t('selectPrompt')}</div>
            )}
            <MessageInput
                disabled={!selectedEmployee}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                onSend={async (text) => {
                    const payload = replyTo ? composeReplyMessage(replyTo.messageText, text) : text;
                    setReplyTo(null);
                    await onSend(payload);
                }}
            />
        </section>
    );
}
