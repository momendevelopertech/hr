'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';

export default function NotificationsClient({ locale }: { locale: string }) {
    const { ready } = useRequireAuth(locale);
    const [items, setItems] = useState<any[]>([]);

    const fetchAll = async () => {
        const res = await api.get('/notifications');
        setItems(res.data);
    };

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [ready]);

    const markAll = async () => {
        await api.patch('/notifications/read-all');
        fetchAll();
    };

    return (
        <main className="px-6 pb-12">
            <section className="card p-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Notifications</h2>
                    <button className="btn-outline" onClick={markAll}>Mark all read</button>
                </div>
                <div className="mt-4 space-y-3">
                    {items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-ink/10 bg-white/70 p-4">
                            <p className="font-semibold">{item.title}</p>
                            <p className="text-xs text-ink/60">{item.body}</p>
                            <p className="mt-2 text-[11px] text-ink/40">{new Date(item.createdAt).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
