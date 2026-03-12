'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { usePusherChannel } from '@/lib/use-pusher-channel';
import StatsGrid from './StatsGrid';
import CalendarView from './CalendarView';
import RequestModal from './RequestModal';
import EventDetailsModal from './EventDetailsModal';
import ChangePasswordModal from './ChangePasswordModal';
import { useRequireAuth } from '@/lib/use-auth';
import { useTranslations } from 'next-intl';
import { enumLabels } from '@/lib/enum-labels';
import PageLoader from './PageLoader';

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

type NoteItem = {
    id: string;
    title: string;
    body?: string | null;
    date: string;
    user: { fullName: string };
};

type LatenessItem = {
    id: string;
    date: string;
    minutesLate: number;
    status?: string;
};

export default function DashboardClient({ locale }: { locale: 'en' | 'ar' }) {
    const t = useTranslations('dashboard');
    const tm = useTranslations('requestModal');
    const { user, ready } = useRequireAuth(locale);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
    const [forms, setForms] = useState<FormSubmission[]>([]);
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [latenessItems, setLatenessItems] = useState<LatenessItem[]>([]);
    const [balances, setBalances] = useState<any[]>([]);
    const [permissionCycle, setPermissionCycle] = useState<any | null>(null);
    const [absenceDeduction, setAbsenceDeduction] = useState<any | null>(null);
    const [announcement, setAnnouncement] = useState({ title: '', body: '' });
    const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
    const [sendingPayroll, setSendingPayroll] = useState(false);
    const [announcementOpen, setAnnouncementOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [schedule, setSchedule] = useState<any | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [leaveBalances, leaveReqs, permissionReqs, formSubs, notesRes, cycle, absence, scheduleRes, latenessRes] = await Promise.all([
                api.get('/leaves/balances'),
                api.get('/leaves'),
                api.get('/permissions'),
                api.get('/forms/submissions'),
                api.get('/notes'),
                api.get('/permissions/cycle'),
                api.get('/leaves/absence-deductions'),
                api.get('/settings/work-schedule'),
                api.get('/lateness', {
                    params: {
                        from: '2000-01-01',
                        to: '2100-12-31',
                    },
                }),
            ]);
            setBalances(leaveBalances.data);
            setLeaves(leaveReqs.data);
            setPermissions(permissionReqs.data);
            setForms(formSubs.data);
            setNotes(notesRes.data);
            setPermissionCycle(cycle.data);
            setAbsenceDeduction(absence.data);
            setSchedule(scheduleRes.data);
            setLatenessItems(latenessRes.data?.items || []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [ready, fetchAll]);

    const notificationHandlers = useMemo(
        () => ({
            notification: () => fetchAll(),
        }),
        [fetchAll],
    );

    usePusherChannel(user ? `user-${user.id}` : null, notificationHandlers);

    const stats = useMemo(() => {
        const annual = balances.find((b) => b.leaveType === 'ANNUAL');
        const totalRemaining = annual?.remainingDays ?? 0;
        const usedPermissions = permissionCycle?.usedHours ?? 0;
        const pending = [...leaves, ...permissions, ...forms].filter((r) => r.status === 'PENDING').length;
        return [
            { label: 'leaveBalance', value: `${totalRemaining} ${t('days')}` },
            { label: 'permissionUsed', value: `${usedPermissions}h` },
            { label: 'permissionRemaining', value: `${permissionCycle?.remainingHours ?? 4}h` },
            { label: 'pendingApprovals', value: `${pending}` },
            { label: 'absenceDeduction', value: `${absenceDeduction?.deductedDays ?? 0} ${t('days')}` },
        ];
    }, [absenceDeduction?.deductedDays, balances, leaves, permissions, forms, permissionCycle?.remainingHours, permissionCycle?.usedHours, t]);

    const canBroadcast = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    const sendAnnouncement = async () => {
        if (!announcement.title.trim() || !announcement.body.trim()) return;
        setSendingAnnouncement(true);
        try {
            await api.post('/notifications/announcement', {
                title: announcement.title.trim(),
                titleAr: announcement.title.trim(),
                body: announcement.body.trim(),
                bodyAr: announcement.body.trim(),
            });
            setAnnouncement({ title: '', body: '' });
            setAnnouncementOpen(false);
            toast.success(t('announcementSent'));
        } finally {
            setSendingAnnouncement(false);
        }
    };

    const triggerPayroll = async () => {
        setSendingPayroll(true);
        try {
            await api.post('/notifications/payroll');
            toast.success(t('payrollSent'));
        } finally {
            setSendingPayroll(false);
        }
    };

    const events = useMemo(() => {
        const leaveEvents = leaves.map((leave) => {
            let key = 'leave';
            if (leave.leaveType === 'ABSENCE_WITH_PERMISSION') key = 'absence';
            if (leave.leaveType === 'MISSION') key = 'mission';

            return {
                title: `${leave.user.fullName} - ${enumLabels.leaveType(leave.leaveType, locale)}`,
                start: new Date(leave.startDate),
                end: new Date(leave.endDate),
                allDay: true,
                resource: { key, kind: key === 'absence' ? 'absence' : key === 'mission' ? 'mission' : 'leave', item: leave },
            };
        });

        const permissionEvents = permissions.map((permission) => ({
            title: `${permission.user.fullName} - ${enumLabels.permissionType(permission.permissionType, locale)}`,
            start: new Date(permission.requestDate),
            end: new Date(permission.requestDate),
            allDay: true,
            resource: { key: permission.permissionType === 'PERSONAL' ? 'personal' : 'permission', kind: 'permission', item: permission },
        }));

        const formEvents = forms.map((submission) => ({
            title: `${submission.user.fullName} - ${submission.form.name}`,
            start: new Date(submission.createdAt),
            end: new Date(submission.createdAt),
            allDay: true,
            resource: { key: 'form', kind: 'form', item: submission },
        }));

        const noteEvents = notes.map((note) => ({
            title: `${note.user.fullName} - ${note.title}`,
            start: new Date(note.date),
            end: new Date(note.date),
            allDay: true,
            resource: { key: 'note', kind: 'note', item: note },
        }));

        const latenessEvents = latenessItems.map((item) => ({
            title: `${user?.fullName || (locale === 'ar' ? 'الموظف' : 'Employee')} - ${tm('latenessRequest')}`,
            start: new Date(item.date),
            end: new Date(item.date),
            allDay: true,
            resource: { key: 'lateness', kind: 'lateness', item: { ...item, user } },
        }));

        return [...leaveEvents, ...permissionEvents, ...formEvents, ...noteEvents, ...latenessEvents];
    }, [forms, latenessItems, leaves, locale, notes, permissions, tm, user]);

    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل لوحة التحكم...' : 'Loading dashboard...'} />;
    }

    return (
        <main className="pb-12">
            <StatsGrid stats={stats} />
            {canBroadcast && (
                <div className="px-6 mt-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <button className="btn-primary" onClick={() => setAnnouncementOpen(true)}>
                            {t('sendAnnouncement')}
                        </button>
                        <button className="btn-secondary" onClick={triggerPayroll} disabled={sendingPayroll}>
                            {sendingPayroll ? t('payrollProcessing') : t('payrollButton')}
                        </button>
                    </div>
                </div>
            )}
            <div className="px-6 mt-6">
                <CalendarView
                    locale={locale}
                    events={events}
                    schedule={schedule}
                    onSelectSlot={(d) => setSelectedDate(d)}
                    onSelectEvent={(event) => {
                        setSelectedDate(null);
                        setSelectedEvent(event);
                    }}
                />
            </div>
            <RequestModal
                open={!!selectedDate}
                date={selectedDate}
                locale={locale}
                onClose={() => setSelectedDate(null)}
                onSubmitted={fetchAll}
            />
            {announcementOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="card w-full max-w-2xl p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('announcementTitle')}</h3>
                            <button className="btn-outline" onClick={() => setAnnouncementOpen(false)}>{t('close')}</button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2 md:col-span-1"
                                placeholder={t('announcementTitlePlaceholder')}
                                value={announcement.title}
                                onChange={(e) => setAnnouncement((prev) => ({ ...prev, title: e.target.value }))}
                            />
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2 md:col-span-2"
                                placeholder={t('announcementBodyPlaceholder')}
                                value={announcement.body}
                                onChange={(e) => setAnnouncement((prev) => ({ ...prev, body: e.target.value }))}
                            />
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="btn-outline" onClick={() => setAnnouncementOpen(false)}>
                                {t('cancel')}
                            </button>
                            <button className="btn-primary" onClick={sendAnnouncement} disabled={sendingAnnouncement}>
                                {sendingAnnouncement ? t('sending') : t('sendAnnouncement')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <EventDetailsModal
                open={!!selectedEvent}
                event={selectedEvent}
                locale={locale}
                onClose={() => setSelectedEvent(null)}
            />
            <ChangePasswordModal />
        </main>
    );
}
