'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';

type Department = { id: string; name: string };
type FormField = {
    label: string;
    labelAr: string;
    fieldType: string;
    isRequired?: boolean;
    options?: string[];
};

export default function FormsBuilderClient({ locale }: { locale: string }) {
    const { user, ready } = useRequireAuth(locale);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [forms, setForms] = useState<any[]>([]);
    const [form, setForm] = useState<any>({});
    const [fields, setFields] = useState<FormField[]>([]);

    const fetchAll = async () => {
        const [deptRes, formsRes] = await Promise.all([api.get('/departments'), api.get('/forms')]);
        setDepartments(deptRes.data);
        setForms(formsRes.data);
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

    const addField = () => {
        setFields((prev) => [...prev, { label: '', labelAr: '', fieldType: 'TEXT', isRequired: false }]);
    };

    const updateField = (index: number, patch: Partial<FormField>) => {
        setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
    };

    const createForm = async () => {
        await api.post('/forms', {
            name: form.name,
            nameAr: form.nameAr,
            description: form.description,
            descriptionAr: form.descriptionAr,
            departmentId: form.departmentId || null,
            fields,
        });
        setForm({});
        setFields([]);
        fetchAll();
    };

    const deactivateForm = async (id: string) => {
        await api.delete(`/forms/${id}`);
        fetchAll();
    };

    return (
        <main className="px-6 pb-12 space-y-6">
            <section className="card p-5">
                <h2 className="text-lg font-semibold">Create Dynamic Form</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Form Name" onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Form Name (AR)" onChange={(e) => setForm((p: any) => ({ ...p, nameAr: e.target.value }))} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Description" onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))} />
                    <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Description (AR)" onChange={(e) => setForm((p: any) => ({ ...p, descriptionAr: e.target.value }))} />
                    <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" onChange={(e) => setForm((p: any) => ({ ...p, departmentId: e.target.value }))}>
                        <option value="">Visible to All</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                <div className="mt-4 space-y-3">
                    {fields.map((field, index) => (
                        <div key={index} className="grid gap-2 md:grid-cols-4">
                            <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Label" onChange={(e) => updateField(index, { label: e.target.value })} />
                            <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder="Label (AR)" onChange={(e) => updateField(index, { labelAr: e.target.value })} />
                            <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" onChange={(e) => updateField(index, { fieldType: e.target.value })}>
                                <option value="TEXT">Text</option>
                                <option value="TEXTAREA">Textarea</option>
                                <option value="NUMBER">Number</option>
                                <option value="DATE">Date</option>
                                <option value="TIME">Time</option>
                                <option value="SELECT">Select</option>
                                <option value="CHECKBOX">Checkbox</option>
                                <option value="FILE">File</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" onChange={(e) => updateField(index, { isRequired: e.target.checked })} />
                                Required
                            </label>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex gap-2">
                    <button className="btn-outline" onClick={addField}>Add Field</button>
                    <button className="btn-primary" onClick={createForm}>Create Form</button>
                </div>
            </section>

            <section className="card p-5">
                <h2 className="text-lg font-semibold">Existing Forms</h2>
                <div className="mt-4 space-y-3">
                    {forms.map((form) => (
                        <div key={form.id} className="rounded-xl border border-ink/10 bg-white/70 p-4 flex items-center justify-between">
                            <div>
                                <p className="font-semibold">{form.name}</p>
                                <p className="text-xs text-ink/60">{form.department?.name || 'All Departments'}</p>
                            </div>
                            <button className="btn-outline" onClick={() => deactivateForm(form.id)}>Deactivate</button>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
