'use client';

import { ChatEmployee } from './types';

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
    return (
        <aside className="w-full border-r border-ink/10 md:w-80">
            <div className="p-3">
                <input
                    className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                    placeholder="Search employees"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-2 pb-2">
                {employees.map((employee) => (
                    <button
                        key={employee.id}
                        onClick={() => onSelect(employee)}
                        className={`mb-1 w-full rounded-xl px-3 py-3 text-left ${selectedId === employee.id ? 'bg-ink/10' : 'hover:bg-ink/5'}`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{employee.fullName}</p>
                            {!!employee.unreadCount && (
                                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{employee.unreadCount}</span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500">{employee.jobTitle || 'No job title'}</p>
                    </button>
                ))}
            </div>
        </aside>
    );
}
