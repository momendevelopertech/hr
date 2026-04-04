'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { isAuthError } from '@/lib/api';
import { usePusherChannel } from '@/lib/use-pusher-channel';
import CalendarView from './CalendarView';
import DashboardSidePanel from './DashboardSidePanel';
import RequestModal from './RequestModal';
import EventDetailsModal from './EventDetailsModal';
import ChangePasswordModal from './ChangePasswordModal';
import { useRequireAuth } from '@/lib/use-auth';
import { useTranslations } from 'next-intl';
import { enumLabels } from '@/lib/enum-labels';
import PageLoader from './PageLoader';
import { Megaphone, Wallet } from 'lucide-react';
import { arSA, enUS } from 'date-fns/locale';
import { addDays, format, getDaysInMonth, isSameDay, isWithinInterval, startOfDay, startOfWeek } from 'date-fns';
import type { SmartAttendanceData, WeekStatus } from './calendar/SmartAttendanceCard';
import { isCompanyFixedOffDay, isCompanyOffDay } from './calendar/companyOffDays';

type Department = { id: string; name: string; nameAr?: string | null };
type EmployeeOption = { id: string; fullName: string; fullNameAr?: string | null };

type LeaveRequest = {
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    status: string;
    approvedByMgrId?: string | null;
    user: { fullName: string };
};

type PermissionRequest = {
    id: string;
    permissionType: string;
    requestDate: string;
    status: string;
    approvedByMgrId?: string | null;
    user: { fullName: string };
};

type FormSubmission = {
    id: string;
    createdAt: string;
    status: string;
    approvedByMgrId?: string | null;
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

type AnnouncementNotification = {
    id: string;
    title: string;
    titleAr?: string | null;
    body?: string | null;
    bodyAr?: string | null;
    metadata?: { kind?: string } | null;
    isRead: boolean;
    createdAt: string;
};

type NotificationsResponse = {
    items: AnnouncementNotification[];
};

type UsersResponse = {
    items: EmployeeOption[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

const formatPermissionDuration = (hours: number, locale: 'en' | 'ar') => {
    const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
    const totalMinutes = Math.round(safeHours * 60);
    const hourPart = Math.floor(totalMinutes / 60);
    const minutePart = totalMinutes % 60;

    if (locale === 'ar') {
        if (hourPart > 0 && minutePart > 0) return `${hourPart} ساعة و${minutePart} دقيقة`;
        if (hourPart > 0) return `${hourPart} ساعة`;
        return `${minutePart} دقيقة`;
    }

    if (hourPart > 0 && minutePart > 0) return `${hourPart}h ${minutePart}m`;
    if (hourPart > 0) return `${hourPart}h`;
    return `${minutePart}m`;
};

export default function DashboardClient({ locale }: { locale: 'en' | 'ar' }) {
    const t = useTranslations('dashboard');
    const tm = useTranslations('requestModal');
    const dateLocale = useMemo(() => (locale === 'ar' ? 'ar-EG' : 'en-US'), [locale]);
    const { user, ready } = useRequireAuth(locale);
    const role = user?.role;
    const isSecretary = role === 'BRANCH_SECRETARY';
    const isManager = role === 'MANAGER';
    const isHr = role === 'HR_ADMIN' || role === 'SUPER_ADMIN';
    const isSandboxEmployee = role === 'EMPLOYEE' && user?.workflowMode === 'SANDBOX';
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
    const [forms, setForms] = useState<FormSubmission[]>([]);
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [hrNotice, setHrNotice] = useState<AnnouncementNotification | null>(null);
    const [markingNotice, setMarkingNotice] = useState(false);
    const [latenessItems, setLatenessItems] = useState<LatenessItem[]>([]);
    const [balances, setBalances] = useState<any[]>([]);
    const [permissionCycle, setPermissionCycle] = useState<any | null>(null);
    const [absenceDeduction, setAbsenceDeduction] = useState<any | null>(null);
    const [announcement, setAnnouncement] = useState({ title: '', body: '' });
    const [departments, setDepartments] = useState<Department[]>([]);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [announcementTarget, setAnnouncementTarget] = useState<{
        scope: 'ALL' | 'DEPARTMENT' | 'GOVERNORATE' | 'USERS';
        departmentId: string;
        governorate: string;
        userIds: string[];
    }>({ scope: 'ALL', departmentId: '', governorate: '', userIds: [] });
    const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
    const [sendingPayroll, setSendingPayroll] = useState(false);
    const [announcementOpen, setAnnouncementOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [schedule, setSchedule] = useState<any | null>(null);

    const refreshInFlight = useRef(false);
    const refreshQueued = useRef(false);
    const refreshQueueSkipActivity = useRef<boolean | null>(null);

    const backgroundConfig = useMemo(() => ({ headers: { 'x-skip-activity': '1' } }), []);

    const refreshAll = useCallback(async (skipActivity = false) => {
        if (refreshInFlight.current) {
            refreshQueued.current = true;
            refreshQueueSkipActivity.current =
                refreshQueueSkipActivity.current === null
                    ? skipActivity
                    : refreshQueueSkipActivity.current && skipActivity;
            return;
        }
        refreshInFlight.current = true;
        try {
            const config = skipActivity ? backgroundConfig : undefined;
            const [leaveBalances, leaveReqs, permissionReqs, formSubs, notesRes, cycle, absence, scheduleRes, latenessRes, announcementsRes] = await Promise.all([
                api.get('/leaves/balances', config),
                api.get('/leaves', {
                    ...(config || {}),
                    params: { includeSelf: 1 },
                }),
                api.get('/permissions', {
                    ...(config || {}),
                    params: { includeSelf: 1 },
                }),
                api.get('/forms/submissions', config),
                api.get('/notes', config),
                api.get('/permissions/cycle', config),
                api.get('/leaves/absence-deductions', config),
                api.get('/settings/work-schedule', config),
                api.get('/lateness', {
                    ...(config || {}),
                    params: {
                        from: '2000-01-01',
                        to: '2100-12-31',
                    },
                }),
                api.get<NotificationsResponse>('/notifications', {
                    ...(config || {}),
                    params: { type: 'ANNOUNCEMENT', status: 'unread', limit: 1 },
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
            setHrNotice(announcementsRes.data?.items?.[0] || null);
        } catch (error) {
            if (isAuthError(error)) return;
        } finally {
            refreshInFlight.current = false;
            if (refreshQueued.current) {
                const queuedSkip = refreshQueueSkipActivity.current ?? false;
                refreshQueued.current = false;
                refreshQueueSkipActivity.current = null;
                void refreshAll(queuedSkip);
            }
        }
    }, [backgroundConfig]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            await refreshAll();
        } finally {
            setLoading(false);
        }
    }, [refreshAll]);

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [ready, fetchAll]);

    const notificationHandlers = useMemo(
        () => ({
            notification: () => refreshAll(true),
        }),
        [refreshAll],
    );

    usePusherChannel(user ? `user-${user.id}` : null, notificationHandlers);

    useEffect(() => {
        if (!ready) return;
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            refreshAll(true);
        }, 60000);
        return () => clearInterval(interval);
    }, [ready, refreshAll]);

    const formatDateOnlyFromIso = useCallback((value?: string) => {
        if (!value) return '';
        const datePart = value.split('T')[0];
        const [year, month, day] = datePart.split('-').map((part) => Number(part));
        if (!year || !month || !day) return new Date(value).toLocaleDateString(dateLocale);
        return new Date(year, month - 1, day).toLocaleDateString(dateLocale);
    }, [dateLocale]);

    const dashboardStats = useMemo(() => {
        const annual = balances.find((b) => b.leaveType === 'ANNUAL');
        const totalRemaining = annual?.remainingDays ?? 0;
        const usedPermissions = permissionCycle?.usedHours ?? 0;
        const remainingPermissions = permissionCycle?.remainingHours ?? 4;
        const pendingTotal = [...leaves, ...permissions, ...forms].filter((r) => r.status === 'PENDING').length;
        const cycleHint = absenceDeduction?.cycleStart && absenceDeduction?.cycleEnd
            ? `${formatDateOnlyFromIso(absenceDeduction.cycleStart)} - ${formatDateOnlyFromIso(absenceDeduction.cycleEnd)}`
            : undefined;

        return {
            totalRemaining,
            usedPermissions,
            remainingPermissions,
            pendingTotal,
            cycleHint,
        };
    }, [absenceDeduction?.cycleEnd, absenceDeduction?.cycleStart, balances, formatDateOnlyFromIso, forms, leaves, permissionCycle?.remainingHours, permissionCycle?.usedHours, permissions]);

    const pendingStats = useMemo(() => {
        const pendingLeaves = leaves.filter((r) => r.status === 'PENDING' && r.leaveType !== 'MISSION' && r.leaveType !== 'ABSENCE_WITH_PERMISSION').length;
        const pendingMission = leaves.filter((r) => r.status === 'PENDING' && r.leaveType === 'MISSION').length;
        const pendingAbsence = leaves.filter((r) => r.status === 'PENDING' && r.leaveType === 'ABSENCE_WITH_PERMISSION').length;
        const pendingPermissions = permissions.filter((r) => r.status === 'PENDING').length;

        return [
            { id: 'pending-permissions', label: t('pendingPermissionsLabel'), value: `${pendingPermissions}`, color: 'amber' as const },
            { id: 'pending-leaves', label: t('pendingLeavesLabel'), value: `${pendingLeaves}`, color: 'teal' as const },
            { id: 'pending-mission', label: t('pendingMissionLabel'), value: `${pendingMission}`, color: 'violet' as const },
            { id: 'pending-absence', label: t('pendingAbsenceLabel'), value: `${pendingAbsence}`, color: 'rose' as const },
        ];
    }, [leaves, permissions, t]);

    const quickGlance = useMemo(() => {
        const items: Array<{ id: string; label: string; value: string; color: 'teal' | 'violet' | 'amber' }> = [
            {
                id: 'leaveBalance',
                label: t('leaveBalance'),
                value: `${dashboardStats.totalRemaining} ${t('days')}`,
                color: 'teal' as const,
            },
            {
                id: 'permissionRemaining',
                label: t('permissionRemaining'),
                value: formatPermissionDuration(dashboardStats.remainingPermissions, locale),
                color: 'violet' as const,
            },
        ];

        if (!isSandboxEmployee) {
            items.push({
                id: 'pendingTotal',
                label: t('pendingApprovals'),
                value: `${dashboardStats.pendingTotal}`,
                color: 'amber' as const,
            });
        }

        return items;
    }, [dashboardStats.pendingTotal, dashboardStats.remainingPermissions, dashboardStats.totalRemaining, isSandboxEmployee, locale, t]);

    const deductionStats = useMemo(() => ([
        {
            id: 'absence',
            label: t('absenceOnly'),
            value: `${absenceDeduction?.absenceDays ?? 0} ${t('days')}`,
            color: 'rose' as const,
        },
        {
            id: 'lateness',
            label: t('latenessOnly'),
            value: `${absenceDeduction?.latenessDeductionDays ?? 0} ${t('days')}`,
            color: 'amber' as const,
        },
    ]), [absenceDeduction?.absenceDays, absenceDeduction?.latenessDeductionDays, t]);

    const approvalItems = useMemo(() => {
        if (!isSecretary && !isManager && !isHr) return [];

        const isAwaitingApproval = (status: string, approvedByMgrId?: string | null) => {
            if (isSecretary) return status === 'PENDING';
            if (isManager) return status === 'MANAGER_APPROVED' && !approvedByMgrId;
            if (isHr) return status === 'MANAGER_APPROVED' && !!approvedByMgrId;
            return false;
        };

        const items: Array<{ id: string; name: string; type: string; color: 'accent' | 'amber' | 'teal' | 'violet' | 'rose' }> = [];

        leaves.filter((r) => isAwaitingApproval(r.status, r.approvedByMgrId)).forEach((leave) => {
            items.push({
                id: `leave-${leave.id}`,
                name: leave.user?.fullName || t('approvalLeaveFallback'),
                type: enumLabels.leaveType(leave.leaveType, locale),
                color: 'teal',
            });
        });

        permissions.filter((r) => isAwaitingApproval(r.status, r.approvedByMgrId)).forEach((permission) => {
            items.push({
                id: `permission-${permission.id}`,
                name: permission.user?.fullName || t('approvalPermissionFallback'),
                type: enumLabels.permissionType(permission.permissionType, locale),
                color: 'amber',
            });
        });

        forms.filter((r) => isAwaitingApproval(r.status, r.approvedByMgrId)).forEach((form) => {
            items.push({
                id: `form-${form.id}`,
                name: form.user?.fullName || form.form?.name || t('approvalFormFallback'),
                type: t('approvalFormType'),
                color: 'violet',
            });
        });

        return items.slice(0, 4);
    }, [forms, isHr, isManager, isSecretary, leaves, locale, permissions, t]);

    const canBroadcast = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_SECRETARY';

    useEffect(() => {
        if (!ready || !canBroadcast) return;
        const loadRecipients = async () => {
            const [deptRes, usersRes] = await Promise.all([
                api.get('/departments'),
                (async () => {
                    const firstPage = await api.get<UsersResponse>('/users', {
                        params: { limit: 100, status: 'active', page: 1 },
                    });
                    const items = [...(firstPage.data?.items || [])];
                    const totalPages = firstPage.data?.totalPages || 1;
                    if (totalPages > 1) {
                        const pages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
                        const responses = await Promise.all(
                            pages.map((page) => api.get<UsersResponse>('/users', {
                                params: { limit: 100, status: 'active', page },
                            })),
                        );
                        responses.forEach((res) => {
                            if (res.data?.items?.length) {
                                items.push(...res.data.items);
                            }
                        });
                    }
                    return { data: { items } };
                })(),
            ]);
            setDepartments(deptRes.data || []);
            setEmployees(usersRes.data?.items || []);
        };
        loadRecipients();
    }, [ready, canBroadcast]);
    const noticeContent = useMemo(() => {
        if (!hrNotice) return null;
        const isPayroll = hrNotice.metadata?.kind === 'PAYROLL';
        const title = locale === 'ar'
            ? hrNotice.titleAr || hrNotice.title || ''
            : hrNotice.title || hrNotice.titleAr || '';
        const body = locale === 'ar'
            ? hrNotice.bodyAr || hrNotice.body || ''
            : hrNotice.body || hrNotice.bodyAr || '';
        return {
            isPayroll,
            title,
            body,
            label: isPayroll ? t('payrollTitle') : t('announcementTitle'),
        };
    }, [hrNotice, locale, t]);

    const sendAnnouncement = async () => {
        if (!announcement.title.trim() || !announcement.body.trim()) return;
        setSendingAnnouncement(true);
        try {
            await api.post('/notifications/announcement', {
                title: announcement.title.trim(),
                titleAr: announcement.title.trim(),
                body: announcement.body.trim(),
                bodyAr: announcement.body.trim(),
                targetScope: announcementTarget.scope,
                departmentId: announcementTarget.departmentId || undefined,
                governorate: announcementTarget.governorate || undefined,
                userIds: announcementTarget.userIds,
            });
            setAnnouncement({ title: '', body: '' });
            setAnnouncementTarget({ scope: 'ALL', departmentId: '', governorate: '', userIds: [] });
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

    const markAnnouncementRead = async () => {
        if (!hrNotice || markingNotice) return;
        setMarkingNotice(true);
        try {
            await api.patch('/notifications/read-type/ANNOUNCEMENT');
            setHrNotice(null);
        } finally {
            setMarkingNotice(false);
        }
    };

    const events = useMemo(() => {
        const leaveEvents = leaves.map((leave) => {
            let key = 'leave';
            if (leave.leaveType === 'ABSENCE_WITH_PERMISSION') key = 'absence';
            if (leave.leaveType === 'MISSION') key = 'mission';

            return {
                title: enumLabels.leaveType(leave.leaveType, locale),
                start: new Date(leave.startDate),
                end: new Date(leave.endDate),
                allDay: true,
                resource: { key, kind: key === 'absence' ? 'absence' : key === 'mission' ? 'mission' : 'leave', item: leave },
            };
        });

        const permissionEvents = permissions.map((permission) => ({
            title: enumLabels.permissionType(permission.permissionType, locale),
            start: new Date(permission.requestDate),
            end: new Date(permission.requestDate),
            allDay: true,
            resource: { key: permission.permissionType === 'PERSONAL' ? 'personal' : 'permission', kind: 'permission', item: permission },
        }));

        const formEvents = forms.map((submission) => ({
            title: submission.form.name,
            start: new Date(submission.createdAt),
            end: new Date(submission.createdAt),
            allDay: true,
            resource: { key: 'form', kind: 'form', item: submission },
        }));

        const noteEvents = notes.map((note) => ({
            title: note.title,
            start: new Date(note.date),
            end: new Date(note.date),
            allDay: true,
            resource: { key: 'note', kind: 'note', item: note },
        }));

        const latenessEvents = latenessItems.map((item) => ({
            title: tm('latenessRequest'),
            start: new Date(item.date),
            end: new Date(item.date),
            allDay: true,
            resource: { key: 'lateness', kind: 'lateness', item: { ...item, user } },
        }));

        return [...leaveEvents, ...permissionEvents, ...formEvents, ...noteEvents, ...latenessEvents];
    }, [forms, latenessItems, leaves, locale, notes, permissions, tm, user]);

    const todayItems = useMemo(() => {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        const kindLabel = (kind: string) => {
            switch (kind) {
                case 'leave':
                    return t('eventLeave');
                case 'absence':
                    return t('eventAbsence');
                case 'mission':
                    return t('eventMission');
                case 'permission':
                case 'personal':
                    return t('eventPermission');
                case 'form':
                    return t('eventForm');
                case 'note':
                    return t('eventNote');
                case 'lateness':
                    return t('eventLateness');
                default:
                    return t('eventDefault');
            }
        };

        const kindColor = (kind: string) => {
            switch (kind) {
                case 'leave':
                case 'absence':
                    return 'teal' as const;
                case 'permission':
                case 'personal':
                    return 'amber' as const;
                case 'mission':
                    return 'accent' as const;
                case 'form':
                    return 'violet' as const;
                case 'lateness':
                    return 'rose' as const;
                default:
                    return 'accent' as const;
            }
        };

        return events
            .filter((event) => {
                const start = new Date(event.start);
                const end = new Date(event.end);
                return start <= endOfDay && end >= startOfDay;
            })
            .slice(0, 4)
            .map((event, index) => {
                const resource: any = event.resource || {};
                const item = resource.item || {};
                const kind = resource.kind || resource.key || 'event';
                const name = item.user?.fullName || item.user?.fullNameAr || event.title || t('eventDefault');

                return {
                    id: `today-${index}-${event.title}`,
                    name,
                    type: kindLabel(kind),
                    color: kindColor(kind),
                };
            });
    }, [events, t]);

    const attendanceData = useMemo<SmartAttendanceData>(() => {
        const now = new Date();
        const todayStart = startOfDay(now);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth(), getDaysInMonth(now));
        const monthDays = Array.from({ length: getDaysInMonth(now) }, (_, index) => new Date(now.getFullYear(), now.getMonth(), index + 1));
        const isWorkingDay = (day: Date) => !isCompanyOffDay(day);
        const todayRangeEnd = todayStart;
        const workingDays = monthDays.filter(isWorkingDay).length;
        const elapsedWorkingDays = monthDays.filter((day) => day <= todayStart && isWorkingDay(day)).length;
        const localeRef = locale === 'ar' ? arSA : enUS;

        const dayStatus = new Map<string, WeekStatus['status']>();

        latenessItems.forEach((item) => {
            const date = new Date(item.date);
            if (!isWithinInterval(date, { start: monthStart, end: todayRangeEnd })) return;
            if (!isWorkingDay(date)) return;
            dayStatus.set(format(date, 'yyyy-MM-dd'), 'late');
        });

        events.forEach((event) => {
            if (!isWithinInterval(event.start, { start: monthStart, end: todayRangeEnd })) return;
            const key = event.resource?.key;
            const dateKey = format(event.start, 'yyyy-MM-dd');
            if (!isWorkingDay(event.start)) return;
            if (key === 'absence') {
                dayStatus.set(dateKey, 'absent');
                return;
            }
            if (key === 'lateness' && dayStatus.get(dateKey) !== 'absent') {
                dayStatus.set(dateKey, 'late');
            }
        });

        let attendanceDays = 0;
        let lateDays = 0;
        let absentDays = 0;

        monthDays.forEach((day) => {
            if (day > todayStart || !isWorkingDay(day)) return;
            const status = dayStatus.get(format(day, 'yyyy-MM-dd'));
            if (status === 'absent') {
                absentDays += 1;
                return;
            }
            if (status === 'late') {
                lateDays += 1;
            }
            attendanceDays += 1;
        });

        const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
        const currentWeekStatus: WeekStatus[] = Array.from({ length: 7 }, (_, index) => {
            const date = addDays(currentWeekStart, index);
            const dateKey = format(date, 'yyyy-MM-dd');
            let status: WeekStatus['status'] = 'off';
            if (isCompanyFixedOffDay(date)) status = 'holiday';
            else if (!isWorkingDay(date)) status = 'off';
            else if (date > todayStart) status = 'off';
            else if (isSameDay(date, now)) status = 'today';
            else status = dayStatus.get(dateKey) || 'present';

            return {
                dayKey: format(date, 'EEE', { locale: localeRef }),
                status,
            };
        });

        return {
            attendanceDays,
            lateDays,
            absentDays,
            remainingDays: Math.max(0, workingDays - elapsedWorkingDays),
            monthProgress: workingDays === 0 ? 0 : ((attendanceDays + lateDays + absentDays) / workingDays) * 100,
            currentWeekStatus,
            currentMonthLabel: format(now, 'MMMM yyyy', { locale: localeRef }),
        };
    }, [events, latenessItems, locale]);


    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل لوحة التحكم...' : 'Loading dashboard...'} />;
    }

    return (
        <main className="dashboard-page pb-12">
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
            {noticeContent && (
                <div className="px-6 mt-6">
                    <div className="surface-panel rounded-2xl p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className={`flex h-11 w-11 items-center justify-center rounded-full border ${noticeContent.isPayroll ? 'tone-amber' : 'tone-teal'}`}>
                                    {noticeContent.isPayroll ? <Wallet size={20} /> : <Megaphone size={20} />}
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{noticeContent.label}</p>
                                    <p className="text-sm font-semibold">{noticeContent.title || noticeContent.label}</p>
                                    {noticeContent.body && <p className="text-sm text-ink/60">{noticeContent.body}</p>}
                                </div>
                            </div>
                            <button className="btn-primary" onClick={markAnnouncementRead} disabled={markingNotice}>
                                {markingNotice ? t('markingRead') : t('markRead')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="px-6 mt-6">
                <div className="dashboard-body-wrap">
                    <div className="min-w-0">
                        <CalendarView
                            locale={locale}
                            events={events}
                            attendanceData={attendanceData}
                            schedule={schedule}
                            onSelectSlot={(d) => setSelectedDate(d)}
                            onSelectEvent={(event) => {
                                setSelectedDate(null);
                                setSelectedEvent(event);
                            }}
                        />
                    </div>
                    <DashboardSidePanel
                        attendanceData={attendanceData}
                        quickGlance={quickGlance}
                        pendingStats={pendingStats}
                        todayItems={todayItems}
                        approvalItems={approvalItems}
                        deductionStats={deductionStats}
                        deductionHint={dashboardStats.cycleHint}
                        showPendingRequests={!isSandboxEmployee}
                    />
                </div>
            </div>
            <RequestModal
                open={!!selectedDate}
                date={selectedDate}
                locale={locale}
                onClose={() => setSelectedDate(null)}
                onSubmitted={fetchAll}
            />
            {announcementOpen && (
                <div className="overlay-backdrop fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div className="modal-shell w-full max-w-2xl rounded-3xl p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('announcementTitle')}</h3>
                            <button className="btn-outline" onClick={() => setAnnouncementOpen(false)}>{t('close')}</button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <input
                                className="field px-3 py-2 md:col-span-1"
                                placeholder={t('announcementTitlePlaceholder')}
                                value={announcement.title}
                                onChange={(e) => setAnnouncement((prev) => ({ ...prev, title: e.target.value }))}
                            />
                            <input
                                className="field px-3 py-2 md:col-span-2"
                                placeholder={t('announcementBodyPlaceholder')}
                                value={announcement.body}
                                onChange={(e) => setAnnouncement((prev) => ({ ...prev, body: e.target.value }))}
                            />
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <select
                                className="field px-3 py-2"
                                value={announcementTarget.scope}
                                onChange={(e) => setAnnouncementTarget((prev) => ({ ...prev, scope: e.target.value as any, departmentId: '', governorate: '', userIds: [] }))}
                            >
                                <option value="ALL">{t('targetAll')}</option>
                                <option value="GOVERNORATE">{t('targetGovernorate')}</option>
                                <option value="DEPARTMENT">{t('targetDepartment')}</option>
                                <option value="USERS">{t('targetEmployees')}</option>
                            </select>
                            {announcementTarget.scope === 'GOVERNORATE' && (
                                <select
                                    className="field px-3 py-2 md:col-span-2"
                                    value={announcementTarget.governorate}
                                    onChange={(e) => setAnnouncementTarget((prev) => ({ ...prev, governorate: e.target.value }))}
                                >
                                    <option value="">{t('selectGovernorate')}</option>
                                    <option value="CAIRO">{locale === 'ar' ? 'القاهرة' : 'Cairo'}</option>
                                    <option value="ALEXANDRIA">{locale === 'ar' ? 'الإسكندرية' : 'Alexandria'}</option>
                                </select>
                            )}
                            {announcementTarget.scope === 'DEPARTMENT' && (
                                <select
                                    className="field px-3 py-2 md:col-span-2"
                                    value={announcementTarget.departmentId}
                                    onChange={(e) => setAnnouncementTarget((prev) => ({ ...prev, departmentId: e.target.value }))}
                                >
                                    <option value="">{t('selectDepartment')}</option>
                                    {departments.map((dept) => (
                                        <option key={dept.id} value={dept.id}>{locale === 'ar' ? dept.nameAr || dept.name : dept.name}</option>
                                    ))}
                                </select>
                            )}
                            {announcementTarget.scope === 'USERS' && (
                                <select
                                    multiple
                                    className="field min-h-[110px] px-3 py-2 md:col-span-2"
                                    value={announcementTarget.userIds}
                                    onChange={(e) => setAnnouncementTarget((prev) => ({ ...prev, userIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
                                >
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>{locale === 'ar' ? emp.fullNameAr || emp.fullName : emp.fullName}</option>
                                    ))}
                                </select>
                            )}
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
