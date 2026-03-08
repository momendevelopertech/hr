'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';

type Department = { id: string; name: string; nameAr?: string };

export default function DepartmentsClient({ locale }: { locale: string }) {
    const { user, ready } = useRequireAuth(locale);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [form, setForm] = useState<any>({});

    const fetchAll = async () => {
        const res = await api.get('/departments');
        setDepartments(res.data);
    };

    useEffect(() => {
        if (!ready) return;
        fetchAll();
    }, [ready]);

    const canAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    const createDepartment = async () => {
        await api.post('/departments', {
            name: form.name,
            nameAr: form.nameAr,
            description: form.description,
        });
        setForm({});
        fetchAll();
    };

    const deleteDepartment = async (id: string) => {
        await api.delete(`/departments/${id}`);
        fetchAll();
    };

    return (
        <main className="px-6 pb-12 space-y-6">
            {canAdmin && (
                <section className="card p-5">
                    <h2 className="text-lg font-semibold">Create Department</h2>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Name" onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))} />
                        <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Name (AR)" onChange={(e) => setForm((p: any) => ({ ...p, nameAr: e.target.value }))} />
                        <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Description" onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))} />
                    </div>
                    <button className="btn-primary mt-4" onClick={createDepartment}>Create</button>
                </section>
            )}

            <section className="card p-5">
                <h2 className="text-lg font-semibold">Departments</h2>
                <div className="mt-4 space-y-3">
                    {departments.map((dept) => (
                        <div key={dept.id} className="rounded-xl border border-ink/10 bg-white/70 p-4 flex items-center justify-between">
                            <div>
                                <p className="font-semibold">{dept.name}</p>
                                <p className="text-xs text-ink/60">{dept.nameAr}</p>
                            </div>
                            {canAdmin && <button className="btn-outline" onClick={() => deleteDepartment(dept.id)}>Delete</button>}
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
