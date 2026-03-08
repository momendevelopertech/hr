'use client';

type NotificationItem = {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    isRead: boolean;
};

export default function NotificationsPanel({ items }: { items: NotificationItem[] }) {
    return (
        <div className="card p-5">
            <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.2em] text-ink/50">Notifications</p>
                <span className="pill bg-ink/10 text-ink">{items.length} new</span>
            </div>
            <div className="mt-4 space-y-3">
                {items.length === 0 && <p className="text-sm text-ink/60">All caught up.</p>}
                {items.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-xl border border-ink/10 bg-white/70 p-3">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-ink/60">{item.body}</p>
                        <p className="mt-2 text-[11px] text-ink/40">
                            {new Date(item.createdAt).toLocaleString()}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
