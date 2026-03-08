'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';
import StatsGrid from './StatsGrid';
import CalendarView from './CalendarView';
import RequestModal from './RequestModal';
import NotificationsPanel from './NotificationsPanel';
import ChangePasswordModal from './ChangePasswordModal';
import { useRequireAuth } from '@/lib/use-auth';

type LeaveRequest = {
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    status: string;
    user: { fullName: string };
};

type PermissionRequest = {
    id: string;
    permissionType: string;
    requestDate: string;
    status: string;
    user: { fullName: string };
};

type FormSubmission = {
    id: string;
    createdAt: string;
    status: string;
    form: { name: string };
    user: { fullName: string };
};

export default function DashboardClient({ locale }: { locale: 'en' | 'ar' }) {
    const { user, setUser } = useAuthStore();
    const { ready } = useRequireAuth(locale);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
    const [forms, setForms] = useState<FormSubmission[]>([]);
    const [balances, setBalances] = useState<any[]>([]);
    const [permissionCycle, setPermissionCycle] = useState<any | null>(null);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const fetchAll = async () => {
        const [me, leaveBalances, leaveReqs, permissionReqs, formSubs, cycle, unread] = await Promise.all([
            api.get('/auth/me'),
            api.get('/leaves/balances'),
            api.get('/leaves'),
            api.get('/permissions'),
            api.get('/forms/submissions'),
            api.get('/permissions/cycle'),
            api.get('/notifications/unread'),
        ]);
        setUser(me.data);
        setBalances(leaveBalances.data);
        setLeaves(leaveReqs.data);
        setPermissions(permissionReqs.data);
        setForms(formSubs.data);
        setPermissionCycle(cycle.data);
        setNotifications(unread.data);
    };

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [ready]);

    useEffect(() => {
        if (!user) return;
        const socket = getSocket();
        socket.emit('join', user.id);
        socket.on('notification', () => fetchAll());
        return () => {
            socket.off('notification');
        };
    }, [user?.id]);

    const stats = useMemo(() => {
        const annual = balances.find((b) => b.leaveType === 'ANNUAL');
        const totalRemaining = annual?.remainingDays ?? 0;
        const usedPermissions = permissionCycle?.usedHours ?? 0;
        const pending = [...leaves, ...permissions, ...forms].filter((r) => r.status === 'PENDING').length;
        const recent = [...leaves, ...permissions, ...forms].slice(0, 5).length;
        return [
            { label: 'leaveBalance', value: `${totalRemaining} days` },
            { label: 'permissionUsed', value: `${usedPermissions}h` },
            { label: 'permissionRemaining', value: `${permissionCycle?.remainingHours ?? 4}h` },
            { label: 'pendingApprovals', value: `${pending}` },
            { label: 'recentRequests', value: `${recent}` },
        ];
    }, [balances, leaves, permissions, forms]);

    const events = useMemo(() => {
        const leaveEvents = leaves.map((leave) => ({
            title: `${leave.user.fullName} - ${leave.leaveType}`,
            start: new Date(leave.startDate),
            end: new Date(leave.endDate),
            allDay: true,
        }));
        const permissionEvents = permissions.map((permission) => ({
            title: `${permission.user.fullName} - ${permission.permissionType}`,
            start: new Date(permission.requestDate),
            end: new Date(permission.requestDate),
            allDay: true,
        }));
        const formEvents = forms.map((submission) => ({
            title: `${submission.user.fullName} - ${submission.form.name}`,
            start: new Date(submission.createdAt),
            end: new Date(submission.createdAt),
            allDay: true,
        }));
        return [...leaveEvents, ...permissionEvents, ...formEvents];
    }, [leaves, permissions, forms]);

    return (
        <main className="pb-12">
            <StatsGrid stats={stats} />
            <div className="px-6 mt-6">
                <CalendarView locale={locale} events={events} onSelectSlot={(d) => setSelectedDate(d)} />
            </div>
            <div className="px-6 mt-6">
                <NotificationsPanel items={notifications} />
            </div>
            <RequestModal
                open={!!selectedDate}
                date={selectedDate}
                locale={locale}
                onClose={() => setSelectedDate(null)}
                onSubmitted={fetchAll}
            />
            <ChangePasswordModal />
        </main>
    );
}
