'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';

type Department = { id: string; name: string };
type User = {
    id: string;
    employeeNumber: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    department?: Department | null;
};

export default function EmployeesClient({ locale }: { locale: string }) {
    const { user, ready } = useRequireAuth(locale);
    const [employees, setEmployees] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [form, setForm] = useState<any>({});

    const fetchAll = async () => {
        const [usersRes, deptRes] = await Promise.all([api.get('/users'), api.get('/departments')]);
        setEmployees(usersRes.data);
        setDepartments(deptRes.data);
    };

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [ready]);

    if (!(user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN')) {
        return (
            <main className="px-6 pb-12">
                <div className="card p-6">Access restricted to HR Admins.</div>
            </main>
        );
    }

    const createEmployee = async () => {
        await api.post('/users', {
            employeeNumber: form.employeeNumber,
            fullName: form.fullName,
            fullNameAr: form.fullNameAr,
            email: form.email,
            phone: form.phone,
            departmentId: form.departmentId,
            jobTitle: form.jobTitle,
            jobTitleAr: form.jobTitleAr,
            fingerprintId: form.fingerprintId,
            role: form.role || 'EMPLOYEE',
            password: form.password || 'Temp@123456',
        });
        setForm({});
        fetchAll();
    };

    const toggleActive = async (emp: User) => {
        await api.patch(`/users/${emp.id}`, { isActive: !emp.isActive });
        fetchAll();
    };

    return (
        <main className="px-6 pb-12 space-y-6">
            <section className="card p-5">
                <h2 className="text-lg font-semibold">Create Employee</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Employee #" onChange={(e) => setForm((p: any) => ({ ...p, employeeNumber: e.target.value }))} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Full Name" onChange={(e) => setForm((p: any) => ({ ...p, fullName: e.target.value }))} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Full Name (AR)" onChange={(e) => setForm((p: any) => ({ ...p, fullNameAr: e.target.value }))} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Email" onChange={(e) => setForm((p: any) => ({ ...p, email: e.target.value }))} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Phone" onChange={(e) => setForm((p: any) => ({ ...p, phone: e.target.value }))} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Job Title" onChange={(e) => setForm((p: any) => ({ ...p, jobTitle: e.target.value }))} />
                    <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" onChange={(e) => setForm((p: any) => ({ ...p, departmentId: e.target.value }))}>
                        <option value="">Department</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" onChange={(e) => setForm((p: any) => ({ ...p, role: e.target.value }))}>
                        <option value="EMPLOYEE">Employee</option>
                        <option value="MANAGER">Manager</option>
                        <option value="HR_ADMIN">HR Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Fingerprint ID" onChange={(e) => setForm((p: any) => ({ ...p, fingerprintId: e.target.value }))} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Temp Password" onChange={(e) => setForm((p: any) => ({ ...p, password: e.target.value }))} />
                </div>
                <button className="btn-primary mt-4" onClick={createEmployee}>Create</button>
            </section>

            <section className="card p-5">
                <h2 className="text-lg font-semibold">Employees</h2>
                <div className="mt-4 space-y-3">
                    {employees.map((emp) => (
                        <div key={emp.id} className="rounded-xl border border-ink/10 bg-white/70 p-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="font-semibold">{emp.fullName} • {emp.employeeNumber}</p>
                                <p className="text-xs text-ink/60">{emp.email} • {emp.department?.name || 'N/A'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="pill bg-ink/10 text-ink">{emp.role}</span>
                                <button className="btn-outline" onClick={() => toggleActive(emp)}>
                                    {emp.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
