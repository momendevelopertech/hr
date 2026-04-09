'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { enumLabels } from '@/lib/enum-labels';
import { useRequireAuth } from '@/lib/use-auth';
import { formatPermissionDuration } from '@/lib/permission-duration';
import PageLoader from './PageLoader';

type RequestType = 'leave' | 'permission';

type UserInfo = {
    fullName: string;
    fullNameAr?: string | null;
    employeeNumber: string;
};

type ManagerInfo = {
    fullName: string;
    fullNameAr?: string | null;
} | null;

type LeaveDetails = {
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason?: string | null;
    status: string;
    approvedByMgrId?: string | null;
    approvedByHrId?: string | null;
    user: UserInfo;
    approvedByMgr?: ManagerInfo;
};

type PermissionDetails = {
    id: string;
    permissionType: string;
    requestDate: string;
    hoursUsed: number;
    arrivalTime?: string | null;
    leaveTime?: string | null;
    reason?: string | null;
    status: string;
    approvedByMgrId?: string | null;
    approvedByHrId?: string | null;
    user: UserInfo;
    approvedByMgr?: ManagerInfo;
};

export default function RequestPrintPreview({
    locale,
    requestType,
    id,
}: {
    locale: string;
    requestType: RequestType;
    id: string;
}) {
    const { ready } = useRequireAuth(locale);
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<LeaveDetails | PermissionDetails | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!ready) return;
        let active = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const endpoint = requestType === 'leave' ? `/leaves/${id}` : `/permissions/${id}`;
                const res = await api.get(endpoint);
                if (!active) return;
                setDetails(res.data);
            } catch (err: any) {
                if (!active) return;
                setError(err?.message || 'تعذر تحميل الطلب.');
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => {
            active = false;
        };
    }, [id, ready, requestType]);

    useEffect(() => {
        if (!details) return;
        const timer = setTimeout(() => {
            if (typeof window !== 'undefined') {
                window.print();
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [details]);

    const dateLocale = 'ar-EG';

    const viewModel = useMemo(() => {
        if (!details) return null;
        const isLeave = requestType === 'leave';
        const data = details as LeaveDetails | PermissionDetails;
        const employeeName = (data.user.fullNameAr || data.user.fullName || '').trim();
        const statusLabel = enumLabels.status(data.status, 'ar', {
            requestType,
            approvedByMgrId: data.approvedByMgrId ?? null,
            approvedByHrId: data.approvedByHrId ?? null,
        });
        const managerName = (data.approvedByMgr?.fullNameAr || data.approvedByMgr?.fullName || '').trim();

        if (isLeave) {
            const leave = data as LeaveDetails;
            return {
                requestName: enumLabels.leaveType(leave.leaveType, 'ar'),
                dateLabel: 'الفترة',
                dateValue: `${new Date(leave.startDate).toLocaleDateString(dateLocale)} - ${new Date(leave.endDate).toLocaleDateString(dateLocale)}`,
                durationLabel: 'عدد الأيام',
                durationValue: `${leave.totalDays}`,
                reason: leave.reason || '-',
                employeeName,
                employeeNumber: leave.user.employeeNumber,
                statusLabel,
                managerName,
            };
        }

        const permission = data as PermissionDetails;
        return {
            requestName: enumLabels.permissionType(permission.permissionType, 'ar'),
            dateLabel: 'تاريخ الإذن',
            dateValue: new Date(permission.requestDate).toLocaleDateString(dateLocale),
            durationLabel: 'المدة',
            durationValue: formatPermissionDuration(permission.hoursUsed, 'ar'),
            reason: permission.reason || '-',
            employeeName,
            employeeNumber: permission.user.employeeNumber,
            statusLabel,
            managerName,
            arrivalTime: permission.arrivalTime || '',
            leaveTime: permission.leaveTime || '',
        };
    }, [details, requestType]);

    if (!ready || loading) {
        return <PageLoader text="جارٍ تحميل الطلب..." />;
    }

    if (error) {
        return (
            <main className="min-h-screen bg-white px-6 py-8 text-ink" dir="rtl">
                <section className="mx-auto w-full max-w-2xl rounded-2xl border border-ink/10 bg-white p-6">
                    <h1 className="text-lg font-semibold">تعذر تحميل الطلب</h1>
                    <p className="mt-2 text-sm text-ink/70">{error}</p>
                </section>
            </main>
        );
    }

    if (!viewModel || !details) return null;

    const isSandboxApproved = details.status === 'HR_APPROVED' && !details.approvedByHrId;
    const isApproved = details.status === 'MANAGER_APPROVED' || details.status === 'HR_APPROVED';
    const approvalText = !isApproved
        ? 'لم يتم اعتماد هذا الطلب بعد.'
        : isSandboxApproved
            ? 'تم اعتماد هذا الطلب تلقائيًا في وضع التجربة.'
            : `تمت الموافقة على هذا الطلب بواسطة المدير${viewModel.managerName ? `: ${viewModel.managerName}` : ' المختص'}.`;

    return (
        <main className="min-h-screen bg-white px-6 py-8 text-ink print:py-0 print:px-0" dir="rtl">
            <section className="mx-auto w-full max-w-3xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm print:max-w-none print:border-none print:p-8 print:shadow-none">
                <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={() => window.print()}
                    >
                        طباعة
                    </button>
                </div>
                <header className="flex items-center justify-between border-b border-ink/10 pb-4" dir="ltr">
                    <div className="flex items-center gap-3">
                        <img
                            src="/brand/sphinx-logo.png"
                            alt="Sphinx Logo"
                            width={160}
                            height={64}
                            className="h-12 w-auto"
                            loading="eager"
                            onError={(event) => {
                                event.currentTarget.src = '/brand/sphinx-logo.svg';
                            }}
                        />
                    </div>
                    <div className="text-right" dir="rtl">
                        <p className="text-sm text-ink/60">شركة ابو الهول للنشر</p>
                        <p className="text-lg font-semibold">نموذج طلب</p>
                    </div>
                </header>

                <div className="mt-6 space-y-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                        <span className="text-ink/60">اسم الطلب</span>
                        <span className="font-semibold">{viewModel.requestName}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                        <span className="text-ink/60">اسم الموظف</span>
                        <span className="font-semibold">{viewModel.employeeName}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                        <span className="text-ink/60">رقم الموظف</span>
                        <span className="font-semibold">{viewModel.employeeNumber}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                        <span className="text-ink/60">{viewModel.dateLabel}</span>
                        <span className="font-semibold">{viewModel.dateValue}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                        <span className="text-ink/60">{viewModel.durationLabel}</span>
                        <span className="font-semibold">{viewModel.durationValue}</span>
                    </div>
                    {'arrivalTime' in viewModel && viewModel.arrivalTime && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                            <span className="text-ink/60">وقت الحضور</span>
                            <span className="font-semibold">{viewModel.arrivalTime}</span>
                        </div>
                    )}
                    {'leaveTime' in viewModel && viewModel.leaveTime && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                            <span className="text-ink/60">وقت الانصراف</span>
                            <span className="font-semibold">{viewModel.leaveTime}</span>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
                        <span className="text-ink/60">سبب الطلب</span>
                        <span className="font-semibold">{viewModel.reason}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-ink/60">حالة الطلب</span>
                        <span className="font-semibold">{viewModel.statusLabel}</span>
                    </div>
                </div>

                <div className="mt-8 text-right text-sm text-ink/80">
                    {approvalText}
                </div>
            </section>
        </main>
    );
}
