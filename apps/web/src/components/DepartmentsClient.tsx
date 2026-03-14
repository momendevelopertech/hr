'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import PageLoader from './PageLoader';
import ConfirmDialog from './ConfirmDialog';

type Branch = { id: number; name: string; nameAr?: string | null; departmentCount?: number; employeeCount?: number };
type DepartmentBranchCount = { branchId: number; count: number };
type Department = {
    id: string;
    name: string;
    nameAr?: string | null;
    description?: string | null;
    branches: Branch[];
    branchCounts: DepartmentBranchCount[];
    totalEmployees: number;
};

type FormState = {
    name: string;
    nameAr?: string;
    description?: string;
    branchIds: number[];
};

export default function DepartmentsClient({ locale }: { locale: string }) {
    const t = useTranslations('departments');
    const tCommon = useTranslations('common');
    const router = useRouter();
    const { user, ready } = useRequireAuth(locale);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [form, setForm] = useState<FormState>({ name: '', nameAr: '', description: '', branchIds: [] });
    const [branchForm, setBranchForm] = useState({ name: '', nameAr: '' });
    const [branchCreateOpen, setBranchCreateOpen] = useState(false);
    const [branchSaving, setBranchSaving] = useState(false);
    const [branchEditOpen, setBranchEditOpen] = useState(false);
    const [branchEditSaving, setBranchEditSaving] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [branchEditForm, setBranchEditForm] = useState({ name: '', nameAr: '' });
    const [pendingBranchDelete, setPendingBranchDelete] = useState<Branch | null>(null);
    const [branchDeleteBusy, setBranchDeleteBusy] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Department | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState(10);
    const cancelLabel = locale === 'ar' ? 'إلغاء' : 'Cancel';

    const canAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

    const branchDepartmentCounts = useMemo(() => {
        const counts = new Map<number, number>();
        departments.forEach((dept) => {
            dept.branches.forEach((branch) => {
                counts.set(branch.id, (counts.get(branch.id) || 0) + 1);
            });
        });
        return counts;
    }, [departments]);

    const getBranchDepartmentCount = (branch: Branch) => (
        typeof branch.departmentCount === 'number'
            ? branch.departmentCount
            : (branchDepartmentCounts.get(branch.id) || 0)
    );

    const getBranchEmployeeCount = (branch: Branch) => (
        typeof branch.employeeCount === 'number' ? branch.employeeCount : 0
    );

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [deptRes, branchRes] = await Promise.all([
                api.get('/departments'),
                api.get('/branches'),
            ]);
            setDepartments(deptRes.data || []);
            setBranches(branchRes.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!ready) return;
        if (!canAdmin) {
            router.replace(`/${locale}`);
            return;
        }
        fetchAll();
    }, [canAdmin, locale, ready, router]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return departments;
        return departments.filter((dept) => {
            const hay = `${dept.name} ${dept.nameAr || ''}`.toLowerCase();
            return hay.includes(query);
        });
    }, [departments, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / rows));
    const paged = useMemo(() => {
        const start = (page - 1) * rows;
        return filtered.slice(start, start + rows);
    }, [filtered, page, rows]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل الفروع والأقسام...' : 'Loading branches & departments...'} />;
    }
    if (!canAdmin) return null;

    const toggleBranch = (branchId: number) => {
        setForm((prev) => {
            const exists = prev.branchIds.includes(branchId);
            const branchIds = exists
                ? prev.branchIds.filter((id) => id !== branchId)
                : [...prev.branchIds, branchId];
            return { ...prev, branchIds };
        });
    };

    const toggleAllBranches = () => {
        setForm((prev) => ({
            ...prev,
            branchIds: prev.branchIds.length === branches.length ? [] : branches.map((branch) => branch.id),
        }));
    };

    const resetForm = () => setForm({ name: '', nameAr: '', description: '', branchIds: [] });
    const resetBranchForm = () => setBranchForm({ name: '', nameAr: '' });
    const resetBranchEditForm = () => setBranchEditForm({ name: '', nameAr: '' });

    const createDepartment = async () => {
        if (!form.name.trim()) {
            alert(locale === 'ar' ? 'اسم القسم مطلوب.' : 'Department name is required.');
            return;
        }
        if (!form.branchIds.length) {
            alert(locale === 'ar' ? 'اختر فرعًا واحدًا على الأقل.' : 'Select at least one branch.');
            return;
        }
        await api.post('/departments', {
            name: form.name.trim(),
            nameAr: form.nameAr,
            description: form.description,
            branches: form.branchIds,
        });
        resetForm();
        setCreateOpen(false);
        await fetchAll();
        router.push(`/${locale}/departments`);
        router.refresh();
    };

    const createBranch = async () => {
        if (!branchForm.name.trim()) {
            alert(locale === 'ar' ? 'اسم الفرع مطلوب.' : 'Branch name is required.');
            return;
        }
        setBranchSaving(true);
        try {
            await api.post('/branches', {
                name: branchForm.name.trim(),
                nameAr: branchForm.nameAr?.trim() || undefined,
            });
            resetBranchForm();
            setBranchCreateOpen(false);
            await fetchAll();
        } catch (error: any) {
            const message = error?.message || (locale === 'ar' ? 'تعذر إضافة الفرع.' : 'Unable to create branch.');
            alert(message);
        } finally {
            setBranchSaving(false);
        }
    };

    const openBranchEdit = (branch: Branch) => {
        setEditingBranch(branch);
        setBranchEditForm({ name: branch.name, nameAr: branch.nameAr || '' });
        setBranchEditOpen(true);
    };

    const saveBranchEdit = async () => {
        if (!editingBranch) return;
        if (!branchEditForm.name.trim()) {
            alert(locale === 'ar' ? 'اسم الفرع مطلوب.' : 'Branch name is required.');
            return;
        }
        setBranchEditSaving(true);
        try {
            await api.patch(`/branches/${editingBranch.id}`, {
                name: branchEditForm.name.trim(),
                nameAr: branchEditForm.nameAr?.trim() || undefined,
            });
            resetBranchEditForm();
            setBranchEditOpen(false);
            setEditingBranch(null);
            await fetchAll();
        } catch (error: any) {
            const message = error?.message || (locale === 'ar' ? 'تعذر تحديث الفرع.' : 'Unable to update branch.');
            alert(message);
        } finally {
            setBranchEditSaving(false);
        }
    };

    const requestDeleteBranch = (branch: Branch) => {
        const departmentCount = getBranchDepartmentCount(branch);
        const employeeCount = getBranchEmployeeCount(branch);
        if (departmentCount > 0 || employeeCount > 0) return;
        setPendingBranchDelete(branch);
    };

    const confirmDeleteBranch = async () => {
        if (!pendingBranchDelete || branchDeleteBusy) return;
        setBranchDeleteBusy(true);
        try {
            await api.delete(`/branches/${pendingBranchDelete.id}`);
            await fetchAll();
        } catch (error: any) {
            const message = error?.message || (locale === 'ar' ? 'تعذر حذف الفرع.' : 'Unable to delete branch.');
            alert(message);
        } finally {
            setBranchDeleteBusy(false);
            setPendingBranchDelete(null);
        }
    };

    const openEdit = (dept: Department) => {
        setEditingDept(dept);
        setForm({
            name: dept.name,
            nameAr: dept.nameAr || '',
            description: dept.description || '',
            branchIds: dept.branches.map((branch) => branch.id),
        });
        setEditOpen(true);
    };

    const saveEdit = async () => {
        if (!editingDept) return;
        if (!form.name.trim()) {
            alert(locale === 'ar' ? 'اسم القسم مطلوب.' : 'Department name is required.');
            return;
        }
        if (!form.branchIds.length) {
            alert(locale === 'ar' ? 'اختر فرعًا واحدًا على الأقل.' : 'Select at least one branch.');
            return;
        }
        await api.patch(`/departments/${editingDept.id}`, {
            name: form.name.trim(),
            nameAr: form.nameAr,
            description: form.description,
            branches: form.branchIds,
        });
        resetForm();
        setEditOpen(false);
        setEditingDept(null);
        await fetchAll();
    };

    const requestDeleteDepartment = (dept: Department) => {
        const hasEmployees = dept.totalEmployees > 0;
        if (hasEmployees) return;
        setPendingDelete(dept);
        setEditOpen(false);
        setEditingDept(null);
    };

    const confirmDeleteDepartment = async () => {
        if (!pendingDelete || deleteBusy) return;
        setDeleteBusy(true);
        try {
            await api.delete(`/departments/${pendingDelete.id}`);
            await fetchAll();
        } finally {
            setDeleteBusy(false);
            setPendingDelete(null);
        }
    };

    const getBranchCount = (dept: Department, branchId: number) =>
        dept.branchCounts.find((entry) => entry.branchId === branchId)?.count || 0;

    return (
        <main className="px-6 pb-12 space-y-6">
            <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">{t('branchesTitle')}</h2>
                        <p className="text-sm text-ink/60">{t('branchesHint')}</p>
                    </div>
                    <button className="btn-primary" onClick={() => setBranchCreateOpen(true)}>{t('branchCreateCta')}</button>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                    {branches.length === 0 && (
                        <p className="text-sm text-ink/60">{t('branchListEmpty')}</p>
                    )}
                    {branches.map((branch) => {
                        const departmentCount = getBranchDepartmentCount(branch);
                        const employeeCount = getBranchEmployeeCount(branch);
                        const deleteBlocked = departmentCount > 0 || employeeCount > 0;
                        return (
                            <div key={branch.id} className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
                                <p className="text-sm font-semibold">
                                    {locale === 'ar' ? (branch.nameAr || branch.name) : branch.name}
                                </p>
                                <p className="text-xs text-ink/60">{t('branchDepartmentsCount', { count: departmentCount })}</p>
                                <p className="text-xs text-ink/60">{t('branchEmployeesCount', { count: employeeCount })}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button className="btn-outline text-xs" onClick={() => openBranchEdit(branch)}>
                                        {t('edit')}
                                    </button>
                                    <button
                                        className={`btn-outline text-xs text-red-600 ${deleteBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={() => requestDeleteBranch(branch)}
                                        disabled={deleteBlocked}
                                    >
                                        {t('delete')}
                                    </button>
                                </div>
                                {departmentCount > 0 && (
                                    <p className="mt-1 text-xs text-rose-600">{t('branchDeleteBlockedDepartments')}</p>
                                )}
                                {departmentCount === 0 && employeeCount > 0 && (
                                    <p className="mt-1 text-xs text-rose-600">{t('branchDeleteBlockedEmployees')}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{t('title')}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                            placeholder={t('search')}
                            value={search}
                            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                        />
                        <button className="btn-primary" onClick={() => setCreateOpen(true)}>{t('createCta')}</button>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink/60">{t('records', { count: filtered.length })}</p>
                    <label className="text-sm">
                        {t('rowsPerPage')}
                        <select
                            className="ms-2 rounded-lg border border-ink/20 px-2 py-1"
                            value={rows}
                            onChange={(e) => { setPage(1); setRows(parseInt(e.target.value, 10)); }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </label>
                </div>

                <div className="mt-4 overflow-x-auto">
                    <table className={`min-w-[920px] w-full text-sm ${locale === 'ar' ? 'text-right' : 'text-left'}`}>
                        <thead className={locale === 'ar' ? 'text-right' : 'text-left'}>
                            <tr className="border-b border-ink/10">
                                <th className="py-2">{t('department')}</th>
                                {branches.map((branch) => (
                                    <th key={branch.id} className="py-2">
                                        {locale === 'ar' ? (branch.nameAr || branch.name) : branch.name}
                                    </th>
                                ))}
                                <th className="py-2">{t('totalEmployees')}</th>
                                <th className="py-2">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className={locale === 'ar' ? 'text-right' : 'text-left'}>
                            {paged.map((dept) => {
                                const hasEmployees = dept.totalEmployees > 0;
                                return (
                                    <tr key={dept.id} className="border-b border-ink/5">
                                        <td className="py-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold">{dept.name}</span>
                                                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/70">
                                                    {t('employeesBadge', { count: dept.totalEmployees })}
                                                </span>
                                            </div>
                                            {dept.nameAr && <p className="text-xs text-ink/60">{dept.nameAr}</p>}
                                            {hasEmployees && <p className="text-xs text-rose-600">{t('deleteBlocked')}</p>}
                                        </td>
                                        {branches.map((branch) => (
                                            <td key={branch.id} className="py-3">{getBranchCount(dept, branch.id)}</td>
                                        ))}
                                        <td className="py-3 font-semibold">{dept.totalEmployees}</td>
                                        <td className="py-3">
                                            <div className="flex flex-wrap gap-2">
                                                <button className="btn-outline" onClick={() => openEdit(dept)}>{t('edit')}</button>
                                                <button
                                                    className={`btn-outline text-red-600 ${dept.totalEmployees > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    onClick={() => requestDeleteDepartment(dept)}
                                                    disabled={dept.totalEmployees > 0}
                                                >
                                                    {t('delete')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <button className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        {t('prev')}
                    </button>
                    <p className="text-sm">{t('page', { page, totalPages })}</p>
                    <button className="btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        {t('next')}
                    </button>
                </div>
            </section>

            {createOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="card w-full max-w-2xl p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('create')}</h3>
                            <button className="btn-outline" onClick={() => { setCreateOpen(false); resetForm(); }}>×</button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('name')}
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            />
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('nameAr')}
                                value={form.nameAr}
                                onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
                            />
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2 md:col-span-2"
                                placeholder={t('description')}
                                value={form.description}
                                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            />
                        </div>
                        <div className="mt-4 space-y-2">
                            <p className="text-sm font-semibold">{t('branches')}</p>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={branches.length > 0 && form.branchIds.length === branches.length}
                                    onChange={toggleAllBranches}
                                />
                                {t('selectAll')}
                            </label>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {branches.map((branch) => (
                                    <label key={branch.id} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={form.branchIds.includes(branch.id)}
                                            onChange={() => toggleBranch(branch.id)}
                                        />
                                        {locale === 'ar' ? (branch.nameAr || branch.name) : branch.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="btn-outline" onClick={() => { setCreateOpen(false); resetForm(); }}>{cancelLabel}</button>
                            <button className="btn-primary" onClick={createDepartment}>{t('createCta')}</button>
                        </div>
                    </div>
                </div>
            )}

            {branchCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="card w-full max-w-lg p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('branchCreate')}</h3>
                            <button className="btn-outline" onClick={() => { setBranchCreateOpen(false); resetBranchForm(); }}>×</button>
                        </div>
                        <div className="mt-4 grid gap-3">
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('branchName')}
                                value={branchForm.name}
                                onChange={(e) => setBranchForm((p) => ({ ...p, name: e.target.value }))}
                            />
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('branchNameAr')}
                                value={branchForm.nameAr}
                                onChange={(e) => setBranchForm((p) => ({ ...p, nameAr: e.target.value }))}
                            />
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="btn-outline" onClick={() => { setBranchCreateOpen(false); resetBranchForm(); }}>{cancelLabel}</button>
                            <button className="btn-primary" onClick={createBranch} disabled={branchSaving}>
                                {branchSaving ? t('saving') : t('branchCreateCta')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {branchEditOpen && editingBranch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="card w-full max-w-lg p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('branchEditTitle')}</h3>
                            <button
                                className="btn-outline"
                                onClick={() => {
                                    setBranchEditOpen(false);
                                    setEditingBranch(null);
                                    resetBranchEditForm();
                                }}
                            >
                                Ã—
                            </button>
                        </div>
                        <div className="mt-4 grid gap-3">
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('branchName')}
                                value={branchEditForm.name}
                                onChange={(e) => setBranchEditForm((p) => ({ ...p, name: e.target.value }))}
                            />
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('branchNameAr')}
                                value={branchEditForm.nameAr}
                                onChange={(e) => setBranchEditForm((p) => ({ ...p, nameAr: e.target.value }))}
                            />
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                className="btn-outline"
                                onClick={() => {
                                    setBranchEditOpen(false);
                                    setEditingBranch(null);
                                    resetBranchEditForm();
                                }}
                            >
                                {cancelLabel}
                            </button>
                            <button className="btn-primary" onClick={saveBranchEdit} disabled={branchEditSaving}>
                                {branchEditSaving ? t('saving') : t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editOpen && editingDept && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="card w-full max-w-2xl p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('editTitle')}</h3>
                            <button className="btn-outline" onClick={() => { setEditOpen(false); setEditingDept(null); resetForm(); }}>×</button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('name')}
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            />
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('nameAr')}
                                value={form.nameAr}
                                onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
                            />
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2 md:col-span-2"
                                placeholder={t('description')}
                                value={form.description}
                                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            />
                        </div>
                        <div className="mt-4 space-y-2">
                            <p className="text-sm font-semibold">{t('branches')}</p>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={branches.length > 0 && form.branchIds.length === branches.length}
                                    onChange={toggleAllBranches}
                                />
                                {t('selectAll')}
                            </label>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {branches.map((branch) => (
                                    <label key={branch.id} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={form.branchIds.includes(branch.id)}
                                            onChange={() => toggleBranch(branch.id)}
                                        />
                                        {locale === 'ar' ? (branch.nameAr || branch.name) : branch.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-col gap-1">
                                <button
                                    className={`btn-outline text-red-600 ${editingDept.totalEmployees > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={() => requestDeleteDepartment(editingDept)}
                                    disabled={editingDept.totalEmployees > 0}
                                >
                                    {t('delete')}
                                </button>
                                {editingDept.totalEmployees > 0 && (
                                    <span className="text-xs text-rose-600">{t('deleteBlocked')}</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button className="btn-outline" onClick={() => { setEditOpen(false); setEditingDept(null); resetForm(); }}>{cancelLabel}</button>
                                <button className="btn-primary" onClick={saveEdit}>{t('save')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!pendingDelete}
                message={t('confirmDelete')}
                confirmLabel={tCommon('confirm')}
                cancelLabel={tCommon('cancel')}
                confirmDisabled={deleteBusy}
                onConfirm={confirmDeleteDepartment}
                onCancel={() => setPendingDelete(null)}
            />
            <ConfirmDialog
                open={!!pendingBranchDelete}
                message={t('branchConfirmDelete')}
                confirmLabel={tCommon('confirm')}
                cancelLabel={tCommon('cancel')}
                confirmDisabled={branchDeleteBusy}
                onConfirm={confirmDeleteBranch}
                onCancel={() => setPendingBranchDelete(null)}
            />
        </main>
    );
}
