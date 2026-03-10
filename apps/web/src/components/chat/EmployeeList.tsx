'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ChatEmployee } from './types';

const formatTime = (value?: string) => {
    if (!value) return '';
    return new Date(value).toLocaleString();
};

export default function EmployeeList({
    employees,
    selectedId,
    onSelect,
    search,
    setSearch,
}: {
    employees: ChatEmployee[];
    selectedId?: string;
    onSelect: (employee: ChatEmployee) => void;
    search: string;
    setSearch: (v: string) => void;
}) {
    const t = useTranslations('chat');

    const emptyState = useMemo(() => {
        if (search.trim()) return t('searchEmpty');
        return t('historyEmpty');
    }, [search, t]);

    return (
        <aside className="w-full border-b border-ink/10 md:w-80 md:border-b-0 md:border-r">
            <div className="sticky top-0 z-10 border-b border-ink/10 bg-white/95 p-3 backdrop-blur">
                <input
                    className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                    placeholder={t('searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <div className="max-h-[38vh] overflow-y-auto px-2 pb-2 md:max-h-[72vh]">
                {employees.length === 0 && <p className="p-3 text-sm text-slate-500">{emptyState}</p>}
                {employees.map((employee) => (
                    <button
                        key={employee.id}
                        onClick={() => onSelect(employee)}
                        className={`mb-1 w-full rounded-xl px-3 py-3 text-start transition ${selectedId === employee.id ? 'bg-ink/10' : 'hover:bg-ink/5'}`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <p className="line-clamp-1 font-medium">{employee.fullName}</p>
                            {!!employee.unreadCount && (
                                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{employee.unreadCount}</span>
                            )}
                        </div>
                        <p className="line-clamp-1 text-xs text-slate-500">{employee.lastMessage || employee.jobTitle || t('noJobTitle')}</p>
                        {employee.lastMessageAt && <p className="mt-1 text-[11px] text-slate-400">{formatTime(employee.lastMessageAt)}</p>}
                    </button>
                ))}
            </div>
        </aside>
    );
}
