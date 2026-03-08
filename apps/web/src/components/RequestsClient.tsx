'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';

type LeaveRequest = {
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    status: string;
    user: { fullName: string; employeeNumber: string };
};

type PermissionRequest = {
    id: string;
    permissionType: string;
    requestDate: string;
    hoursUsed: number;
    status: string;
    user: { fullName: string; employeeNumber: string };
};

type FormSubmission = {
    id: string;
    status: string;
    createdAt: string;
    form: { name: string };
    user: { fullName: string; employeeNumber: string };
};

export default function RequestsClient({ locale }: { locale: string }) {
    const { user, ready } = useRequireAuth(locale);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
    const [forms, setForms] = useState<FormSubmission[]>([]);

    const fetchAll = async () => {
        const [leaveReqs, permissionReqs, formSubs] = await Promise.all([
            api.get('/leaves'),
            api.get('/permissions'),
            api.get('/forms/submissions'),
        ]);
        setLeaves(leaveReqs.data);
        setPermissions(permissionReqs.data);
        setForms(formSubs.data);
    };

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [ready]);

    const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';
    const canAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    const approveLeave = (id: string) => api.patch(`/leaves/${id}/approve`).then(fetchAll);
    const rejectLeave = (id: string) => api.patch(`/leaves/${id}/reject`).then(fetchAll);
    const cancelLeave = (id: string) => api.patch(`/leaves/${id}/cancel`).then(fetchAll);
    const deleteLeave = (id: string) => api.delete(`/leaves/${id}`).then(fetchAll);
    const duplicateLeave = (id: string) => api.post(`/leaves/${id}/duplicate`).then(fetchAll);

    const approvePermission = (id: string) => api.patch(`/permissions/${id}/approve`).then(fetchAll);
    const rejectPermission = (id: string) => api.patch(`/permissions/${id}/reject`).then(fetchAll);
    const cancelPermission = (id: string) => api.patch(`/permissions/${id}/cancel`).then(fetchAll);
    const deletePermission = (id: string) => api.delete(`/permissions/${id}`).then(fetchAll);
    const duplicatePermission = (id: string) => api.post(`/permissions/${id}/duplicate`).then(fetchAll);

    const approveForm = (id: string) => api.patch(`/forms/submissions/${id}/approve`).then(fetchAll);
    const rejectForm = (id: string) => api.patch(`/forms/submissions/${id}/reject`).then(fetchAll);
    const cancelForm = (id: string) => api.patch(`/forms/submissions/${id}/cancel`).then(fetchAll);
    const deleteForm = (id: string) => api.delete(`/forms/submissions/${id}`).then(fetchAll);
    const duplicateForm = (id: string) => api.post(`/forms/submissions/${id}/duplicate`).then(fetchAll);

    return (
        <main className="px-6 pb-12 space-y-6">
            <section className="card p-5">
                <h2 className="text-lg font-semibold">Leave Requests</h2>
                <div className="mt-4 space-y-3">
                    {leaves.map((leave) => (
                        <div key={leave.id} className="rounded-xl border border-ink/10 bg-white/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{leave.user.fullName} • {leave.leaveType}</p>
                                    <p className="text-xs text-ink/60">
                                        {new Date(leave.startDate).toLocaleDateString()} → {new Date(leave.endDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className="pill bg-ink/10 text-ink">{leave.status}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <a className="btn-outline" href={`${process.env.NEXT_PUBLIC_API_URL}/pdf/leave/${leave.id}`} target="_blank">Print PDF</a>
                                <button className="btn-outline" onClick={() => duplicateLeave(leave.id)}>Duplicate</button>
                                <button className="btn-outline" onClick={() => cancelLeave(leave.id)}>Cancel</button>
                                {canManage && (
                                    <>
                                        <button className="btn-primary" onClick={() => approveLeave(leave.id)}>Approve</button>
                                        <button className="btn-secondary" onClick={() => rejectLeave(leave.id)}>Reject</button>
                                    </>
                                )}
                                {canAdmin && <button className="btn-outline" onClick={() => deleteLeave(leave.id)}>Delete</button>}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="card p-5">
                <h2 className="text-lg font-semibold">Permission Requests</h2>
                <div className="mt-4 space-y-3">
                    {permissions.map((perm) => (
                        <div key={perm.id} className="rounded-xl border border-ink/10 bg-white/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{perm.user.fullName} • {perm.permissionType}</p>
                                    <p className="text-xs text-ink/60">{new Date(perm.requestDate).toLocaleDateString()}</p>
                                </div>
                                <span className="pill bg-ink/10 text-ink">{perm.status}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <a className="btn-outline" href={`${process.env.NEXT_PUBLIC_API_URL}/pdf/permission/${perm.id}`} target="_blank">Print PDF</a>
                                <button className="btn-outline" onClick={() => duplicatePermission(perm.id)}>Duplicate</button>
                                <button className="btn-outline" onClick={() => cancelPermission(perm.id)}>Cancel</button>
                                {canManage && (
                                    <>
                                        <button className="btn-primary" onClick={() => approvePermission(perm.id)}>Approve</button>
                                        <button className="btn-secondary" onClick={() => rejectPermission(perm.id)}>Reject</button>
                                    </>
                                )}
                                {canAdmin && <button className="btn-outline" onClick={() => deletePermission(perm.id)}>Delete</button>}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="card p-5">
                <h2 className="text-lg font-semibold">Form Submissions</h2>
                <div className="mt-4 space-y-3">
                    {forms.map((form) => (
                        <div key={form.id} className="rounded-xl border border-ink/10 bg-white/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{form.user.fullName} • {form.form.name}</p>
                                    <p className="text-xs text-ink/60">{new Date(form.createdAt).toLocaleDateString()}</p>
                                </div>
                                <span className="pill bg-ink/10 text-ink">{form.status}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <a className="btn-outline" href={`${process.env.NEXT_PUBLIC_API_URL}/pdf/form/${form.id}`} target="_blank">Print PDF</a>
                                <button className="btn-outline" onClick={() => duplicateForm(form.id)}>Duplicate</button>
                                <button className="btn-outline" onClick={() => cancelForm(form.id)}>Cancel</button>
                                {canManage && (
                                    <>
                                        <button className="btn-primary" onClick={() => approveForm(form.id)}>Approve</button>
                                        <button className="btn-secondary" onClick={() => rejectForm(form.id)}>Reject</button>
                                    </>
                                )}
                                {canAdmin && <button className="btn-outline" onClick={() => deleteForm(form.id)}>Delete</button>}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
