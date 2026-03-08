'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';

export default function ReportsClient({ locale }: { locale: string }) {
    const { user, ready } = useRequireAuth(locale);
    const [leaveReport, setLeaveReport] = useState<any[]>([]);
    const [permissionReport, setPermissionReport] = useState<any[]>([]);
    const [employeeReport, setEmployeeReport] = useState<any[]>([]);

    useEffect(() => {
        if (!ready) return;
        if (!(user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN')) return;
        Promise.all([
            api.get('/reports/leaves'),
            api.get('/reports/permissions'),
            api.get('/reports/employees'),
        ]).then(([leaves, permissions, employees]) => {
            setLeaveReport(leaves.data);
            setPermissionReport(permissions.data);
            setEmployeeReport(employees.data);
        });
    }, [ready, user?.role]);

    if (!(user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN')) {
        return (
            <main className="px-6 pb-12">
                <div className="card p-6">Access restricted to HR Admins.</div>
            </main>
        );
    }

    return (
        <main className="px-6 pb-12 space-y-6">
            <section className="card p-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Leave Report</h2>
                    <a className="btn-outline" href={`${process.env.NEXT_PUBLIC_API_URL}/reports/leaves/excel`} target="_blank">Export Excel</a>
                </div>
                <div className="mt-4 space-y-2">
                    {leaveReport.slice(0, 10).map((item) => (
                        <div key={item.id} className="text-sm text-ink/80">
                            {item.user?.fullName} • {item.leaveType} • {item.status}
                        </div>
                    ))}
                </div>
            </section>

            <section className="card p-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Permission Report</h2>
                    <a className="btn-outline" href={`${process.env.NEXT_PUBLIC_API_URL}/reports/permissions/excel`} target="_blank">Export Excel</a>
                </div>
                <div className="mt-4 space-y-2">
                    {permissionReport.slice(0, 10).map((item) => (
                        <div key={item.id} className="text-sm text-ink/80">
                            {item.user?.fullName} • {item.permissionType} • {item.status}
                        </div>
                    ))}
                </div>
            </section>

            <section className="card p-5">
                <h2 className="text-lg font-semibold">Employee Report</h2>
                <div className="mt-4 space-y-2">
                    {employeeReport.slice(0, 10).map((item) => (
                        <div key={item.id} className="text-sm text-ink/80">
                            {item.fullName} • {item.role} • {item.department?.name}
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
