'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function ChangePasswordModal() {
    const { user, setUser } = useAuthStore();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);

    if (!user?.mustChangePass) return null;

    const submit = async () => {
        setLoading(true);
        try {
            await api.post('/auth/change-password', { currentPassword, newPassword });
            setUser({ ...user, mustChangePass: false });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="card w-full max-w-md p-6">
                <h2 className="text-lg font-semibold">Change Password</h2>
                <p className="text-sm text-ink/60">First login requires a password change.</p>
                <div className="mt-4 space-y-3">
                    <label className="text-sm">
                        Current Password
                        <input
                            type="password"
                            className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                    </label>
                    <label className="text-sm">
                        New Password
                        <input
                            type="password"
                            className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                    </label>
                </div>
                <div className="mt-5 flex justify-end">
                    <button className="btn-primary" onClick={submit} disabled={loading}>
                        {loading ? 'Saving...' : 'Update Password'}
                    </button>
                </div>
            </div>
        </div>
    );
}
