'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
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
            await onSend(
                t(introKey as any, {
                    name: currentName || t('employeeFallback'),
                    department: currentDepartmentLabel,
                    branch: currentBranchLabel,
                    position: currentPositionLabel,
                }),
            );
        } finally {
            setIntroducing(false);
        }
    };

    return (
        <section className="flex min-h-[58vh] flex-1 flex-col md:min-h-[72vh]">
            {selectedEmployee ? (
                <>
                    <header className="border-b border-ink/10 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="font-semibold">{selectedEmployee.fullName}</h3>
                                <p className="text-xs text-slate-500">{selectedEmployee.jobTitle || t('employeeFallback')}</p>
                            </div>
                            <button className="btn-outline text-xs" onClick={handleIntroduce} disabled={introducing}>
                                {introducing ? t('sending') : t('introduceYourself')}
                            </button>
                        </div>
                    </header>
                    <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                        <div className="rounded-xl border border-ink/10 bg-white p-4 text-sm">
                            <h4 className="text-base font-semibold">{t('welcome', { name: selectedEmployee.fullName })}</h4>
                            <p className="mt-1 text-slate-600">{t('position')}: {selectedEmployee.jobTitle || t('noJobTitle')}</p>
                            <p className="text-slate-600">{t('branch')}: {branchLabel}</p>
                        </div>
                        {messages.map((m) => (
                            <MessageBubble key={m.id} message={m} isMine={m.senderId === currentUserId} />
                        ))}
                        <div ref={bottomRef} />
                    </div>
                </>
            ) : (
                <div className="flex flex-1 items-center justify-center p-4 text-center text-slate-500">{t('selectPrompt')}</div>
            )}
            <MessageInput onSend={onSend} disabled={!selectedEmployee} />
        </section>
    );
}
