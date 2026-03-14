'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useRequireAuth } from '@/lib/use-auth';
import { enumLabels } from '@/lib/enum-labels';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import PageLoader from './PageLoader';
import EmployeeHistoryModal from './EmployeeHistoryModal';
import DateRangeFilter from './DateRangeFilter';

type Branch = { id: number; name: string; nameAr?: string | null };
type Department = { id: string; name: string; branches?: Branch[] };
type User = {
    id: string;
    employeeNumber: string;
    username?: string | null;
    fullName: string;
    fullNameAr?: string | null;
    email: string;
    phone?: string;
    role: string;
    governorate?: 'CAIRO' | 'ALEXANDRIA' | null;
    branchId?: number | null;
    isActive: boolean;
    createdAt: string;
    department?: Department | null;
};
type LeaveBalance = {
    leaveType: string;
    totalDays: number;
    remainingDays: number;
    year: number;
};

type UsersResponse = {
    items: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export default function EmployeesClient({ locale }: { locale: string }) {
    const t = useTranslations('employees');
    const router = useRouter();
    const { user, ready } = useRequireAuth(locale);
    const [employees, setEmployees] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [form, setForm] = useState<any>({});
    const [editForm, setEditForm] = useState<any>({});
    const [editOpen, setEditOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [statsOpen, setStatsOpen] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsUser, setStatsUser] = useState<User | null>(null);
    const [statsData, setStatsData] = useState<any | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyUser, setHistoryUser] = useState<User | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState<any>({
        name: '',
        phone: '',
        departmentId: '',
        status: '',
        from: '',
        to: '',
    });

    const debouncedName = useDebouncedValue(filters.name, 400);
    const debouncedPhone = useDebouncedValue(filters.phone, 400);

    const cancelLabel = locale === 'ar' ? 'إلغاء' : 'Cancel';
    const resetLabel = locale === 'ar' ? 'مسح البيانات' : 'Reset Data';
    const canAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
    const canViewEmployees = canAdmin || user?.role === 'MANAGER' || user?.role === 'BRANCH_SECRETARY';

    const normalizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 11);
    const isValidPhone = (value?: string) => !value || /^\d{11}$/.test(value);

    const queryParams = useMemo(() => ({
        page,
        limit,
        ...(debouncedName ? { name: debouncedName } : {}),
        ...(debouncedPhone ? { phone: debouncedPhone } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
    }), [debouncedName, debouncedPhone, filters.departmentId, filters.from, filters.status, filters.to, limit, page]);

    const availableDepartments = useMemo(() => {
        if (!form.branchId) return [];
        return departments.filter((dept) => dept.branches?.some((branch) => branch.id === form.branchId));
    }, [departments, form.branchId]);

    const availableEditDepartments = useMemo(() => {
        if (!editForm.branchId) return [];
        return departments.filter((dept) => dept.branches?.some((branch) => branch.id === editForm.branchId));
    }, [departments, editForm.branchId]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes, deptRes, branchRes] = await Promise.all([
                api.get<UsersResponse>('/users', { params: queryParams }),
                api.get('/departments'),
                api.get('/branches'),
            ]);
            setEmployees(usersRes.data.items || []);
            setTotal(usersRes.data.total || 0);
            setTotalPages(usersRes.data.totalPages || 1);
            setDepartments(deptRes.data);
            setBranches(branchRes.data || []);
        } finally {
            setLoading(false);
        }
    }, [queryParams]);

    useEffect(() => {
        if (!ready) return;
        if (!canViewEmployees) {
            router.replace(`/${locale}`);
            return;
        }
        fetchAll();
    }, [canViewEmployees, locale, ready, router, fetchAll]);

    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل الموظفين...' : 'Loading employees...'} />;
    }
    if (!canViewEmployees) return null;

    const createEmployee = async () => {
        if (!isValidPhone(form.phone)) {
            alert(locale === 'ar' ? 'رقم الهاتف يجب أن يكون 11 رقمًا.' : 'Phone number must be exactly 11 digits.');
            return;
        }
        const role = form.role || 'EMPLOYEE';
        const branchRequired = role !== 'SUPER_ADMIN' && role !== 'HR_ADMIN';
        if (branchRequired && !form.branchId) {
            alert(locale === 'ar' ? 'يجب اختيار الفرع.' : 'Branch is required.');
            return;
        }
        const departmentRequired = role === 'EMPLOYEE' || role === 'MANAGER';
        if (departmentRequired && !form.departmentId) {
            alert(locale === 'ar' ? 'يجب اختيار القسم.' : 'Department is required.');
            return;
        }
        const res = await api.post('/users', {
            employeeNumber: form.employeeNumber,
            fullName: form.fullName,
            fullNameAr: form.fullNameAr,
            email: form.email,
            phone: form.phone,
            branchId: form.branchId,
            departmentId: form.departmentId,
            jobTitle: form.jobTitle,
            jobTitleAr: form.jobTitleAr,
            fingerprintId: form.fingerprintId || form.employeeNumber,
            role: form.role || 'EMPLOYEE',
        });

        const msg = locale === 'ar'
            ? `تم إنشاء المستخدم بنجاح\nاسم المستخدم: ${res.data.generatedUsername}\nكلمة المرور: ${res.data.defaultPassword}`
            : `Employee created successfully\nUsername: ${res.data.generatedUsername}\nPassword: ${res.data.defaultPassword}`;
        alert(msg);

        setForm({});
        setCreateOpen(false);
        setPage(1);
        await fetchAll();
        router.push(`/${locale}/employees`);
        router.refresh();
    };

    const openEdit = async (emp: User) => {
        const res = await api.get(`/users/${emp.id}`);
        const balances: LeaveBalance[] = res.data.leaveBalances || [];
        const annual = balances.find((b) => b.leaveType === 'ANNUAL');
        setEditingUser(emp);
        setEditForm({
            fullName: res.data.fullName,
            fullNameAr: res.data.fullNameAr,
            phone: res.data.phone,
            role: res.data.role,
            governorate: res.data.governorate,
            branchId: res.data.branchId,
            departmentId: res.data.department?.id || '',
            jobTitle: res.data.jobTitle,
            jobTitleAr: res.data.jobTitleAr,
            isActive: res.data.isActive,
            annualLeaveDays: annual?.totalDays ?? 21,
        });
        setEditOpen(true);
    };

    const saveEdit = async () => {
        if (!editingUser) return;
        if (!isValidPhone(editForm.phone)) {
            alert(locale === 'ar' ? 'رقم الهاتف يجب أن يكون 11 رقمًا.' : 'Phone number must be exactly 11 digits.');
            return;
        }
        const role = editForm.role || 'EMPLOYEE';
        const branchRequired = role !== 'SUPER_ADMIN' && role !== 'HR_ADMIN';
        if (branchRequired && !editForm.branchId) {
            alert(locale === 'ar' ? 'يجب اختيار الفرع.' : 'Branch is required.');
            return;
        }
        const departmentRequired = role === 'EMPLOYEE' || role === 'MANAGER';
        if (departmentRequired && !editForm.departmentId) {
            alert(locale === 'ar' ? 'يجب اختيار القسم.' : 'Department is required.');
            return;
        }
        setSavingEdit(true);
        try {
            await api.patch(`/users/${editingUser.id}`, {
                fullName: editForm.fullName,
                fullNameAr: editForm.fullNameAr,
                phone: editForm.phone,
                role: editForm.role,
                branchId: editForm.branchId,
                departmentId: editForm.departmentId || null,
                jobTitle: editForm.jobTitle,
                jobTitleAr: editForm.jobTitleAr,
                isActive: editForm.isActive,
            });

            if (editForm.annualLeaveDays !== undefined && editForm.annualLeaveDays !== '') {
                const year = new Date().getFullYear();
                await api.patch(`/users/${editingUser.id}/leave-balance`, {
                    leaveType: 'ANNUAL',
                    year,
                    totalDays: Number(editForm.annualLeaveDays),
                });
            }
            setEditOpen(false);
            setEditingUser(null);
            setEditForm({});
            await fetchAll();
        } finally {
            setSavingEdit(false);
        }
    };

    const openStats = async (emp: User) => {
        setStatsUser(emp);
        setStatsLoading(true);
        setStatsOpen(true);
        try {
            const res = await api.get(`/users/${emp.id}/stats`);
            setStatsData(res.data);
        } finally {
            setStatsLoading(false);
        }
    };

    const openHistory = (emp: User) => {
        setHistoryUser(emp);
        setHistoryOpen(true);
    };

    const toggleActive = async (emp: User) => {
        await api.patch(`/users/${emp.id}`, { isActive: !emp.isActive });
        fetchAll();
    };
    const resetEmployeeData = async (emp: User) => {
        const confirmText = locale === 'ar'
            ? 'هل أنت متأكد من مسح جميع بيانات الموظف؟ سيتم حذف الإجازات والأذونات والطلبات والسجلات.'
            : 'Are you sure you want to delete all employee data? This will remove leaves, permissions, requests, and records.';
        if (!window.confirm(confirmText)) return;
        await api.post(`/users/${emp.id}/reset-data`);
        alert(locale === 'ar' ? 'تم مسح بيانات الموظف بنجاح.' : 'Employee data has been reset.');
        fetchAll();
    };

    return (
        <main className="px-4 pb-12 sm:px-6 space-y-6">
            {canAdmin && (
                <section className="card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">{t('create')}</h2>
                        <button className="btn-primary" onClick={() => setCreateOpen(true)}>{t('createCta')}</button>
                    </div>
                </section>
            )}

            <section className="card p-5">
                <h2 className="text-lg font-semibold">{t('title')}</h2>

                <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                    <input
                        className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                        placeholder={t('searchNamePlaceholder')}
                        value={filters.name}
                        onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, name: e.target.value })); }}
                    />
                    <input
                        className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                        placeholder={t('searchPhonePlaceholder')}
                        value={filters.phone}
                        onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, phone: e.target.value })); }}
                    />
                    <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" value={filters.departmentId} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, departmentId: e.target.value })); }}>
                        <option value="">{t('department')}</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" value={filters.status} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, status: e.target.value })); }}>
                        <option value="">{t('status')}</option>
                        <option value="active">{t('active')}</option>
                        <option value="inactive">{t('inactive')}</option>
                    </select>
                    <DateRangeFilter
                        locale={locale}
                        from={filters.from}
                        to={filters.to}
                        onChange={({ from, to }) => {
                            setPage(1);
                            setFilters((p: any) => ({ ...p, from, to }));
                        }}
                    />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink/60">{t('records', { count: total })}</p>
                    <label className="text-sm">
                        {t('rowsPerPage')}
                        <select className="ms-2 rounded-lg border border-ink/20 px-2 py-1" value={limit} onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value, 10)); }}>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </label>
                </div>

                <div className="mt-4 overflow-x-auto">
                    <table className={`min-w-[920px] w-full text-sm ${locale === 'ar' ? 'text-right' : 'text-left'}`}>
                        <thead className={locale === 'ar' ? 'text-right' : 'text-left'}>
                            <tr className="border-b border-ink/10">
                                <th className="py-2">#{t('employeeNumber')}</th>
                                <th className="py-2">{t('username')}</th>
                                <th className="py-2">{t('fullName')}</th>
                                <th className="py-2">{t('phone')}</th>
                                <th className="py-2">{t('department')}</th>
                                <th className="py-2">{t('governorate')}</th>
                                <th className="py-2">{t('role')}</th>
                                <th className="py-2">{t('status')}</th>
                                <th className="py-2">{t('created')}</th>
                                {canViewEmployees && <th className="py-2">{t('action')}</th>}
                            </tr>
                        </thead>
                        <tbody className={locale === 'ar' ? 'text-right' : 'text-left'}>
                            {employees.map((emp) => (
                                <tr key={emp.id} className="border-b border-ink/5">
                                    <td className="py-2">{emp.employeeNumber}</td>
                                    <td className="py-2">{emp.username || '-'}</td>
                                    <td className="py-2">{emp.fullName}</td>
                                    <td className="py-2">{emp.phone || '-'}</td>
                                    <td className="py-2">{emp.department?.name || t('notAvailable')}</td>
                                    <td className="py-2">
                                        {emp.governorate === 'CAIRO'
                                            ? t('govCairo')
                                            : emp.governorate === 'ALEXANDRIA'
                                                ? t('govAlexandria')
                                                : t('notAvailable')}
                                    </td>
                                    <td className="py-2">{enumLabels.role(emp.role, locale as 'en' | 'ar')}</td>
                                    <td className="py-2">{emp.isActive ? t('active') : t('inactive')}</td>
                                    <td className="py-2">{new Date(emp.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}</td>
                                    {canViewEmployees && (
                                        <td className="py-2">
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    className="btn-outline border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100"
                                                    onClick={() => openStats(emp)}
                                                >
                                                    {locale === 'ar' ? 'عرض' : 'View'}
                                                </button>
                                                <button
                                                    className="btn-outline border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100"
                                                    onClick={() => openHistory(emp)}
                                                >
                                                    {t('history')}
                                                </button>
                                                {canAdmin && (
                                                    <button
                                                        className="btn-outline border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100"
                                                        onClick={() => openEdit(emp)}
                                                    >
                                                        {locale === 'ar' ? 'تعديل' : 'Edit'}
                                                    </button>
                                                )}
                                                {canAdmin && (
                                                    <button
                                                        className={`btn-outline ${emp.isActive
                                                            ? 'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100'
                                                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
                                                        }`}
                                                        onClick={() => toggleActive(emp)}
                                                    >
                                                        {emp.isActive ? t('deactivate') : t('activate')}
                                                    </button>
                                                )}
                                                {canAdmin && (
                                                    <button
                                                        className="btn-outline border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                                                        onClick={() => resetEmployeeData(emp)}
                                                    >
                                                        {resetLabel}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <button className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t('prev')}</button>
                    <p className="text-sm">{t('page', { page, totalPages })}</p>
                    <button className="btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{t('next')}</button>
                </div>
            </section>

            {createOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="card w-full max-w-4xl p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('create')}</h3>
                            <button className="btn-outline" onClick={() => setCreateOpen(false)}>×</button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder={t('employeeNumberFingerprint')} onChange={(e) => setForm((p: any) => ({ ...p, employeeNumber: e.target.value }))} />
                            <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder={t('fullNameEn')} onChange={(e) => setForm((p: any) => ({ ...p, fullName: e.target.value }))} />
                            <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder={t('fullNameArLabel')} onChange={(e) => setForm((p: any) => ({ ...p, fullNameAr: e.target.value }))} />
                            <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder={t('email')} onChange={(e) => setForm((p: any) => ({ ...p, email: e.target.value }))} />
                            <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder={t('phone')}
                                inputMode="numeric"
                                maxLength={11}
                                value={form.phone || ''}
                                onChange={(e) => setForm((p: any) => ({ ...p, phone: normalizePhone(e.target.value) }))} />
                            <select
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                value={form.branchId || ''}
                                onChange={(e) => {
                                    const value = e.target.value ? Number(e.target.value) : '';
                                    setForm((p: any) => ({ ...p, branchId: value, departmentId: '' }));
                                }}
                            >
                                <option value="">{t('governorate')}</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {locale === 'ar' ? (branch.nameAr || branch.name) : branch.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                value={form.departmentId || ''}
                                onChange={(e) => setForm((p: any) => ({ ...p, departmentId: e.target.value }))}
                                disabled={!form.branchId}
                            >
                                <option value="">{form.branchId ? t('department') : t('selectBranchFirst')}</option>
                                {availableDepartments.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                            <input className="rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder={t('jobTitle')} onChange={(e) => setForm((p: any) => ({ ...p, jobTitle: e.target.value }))} />
                            <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" onChange={(e) => setForm((p: any) => ({ ...p, role: e.target.value }))}>
                                <option value="EMPLOYEE">{t('roles.employee')}</option>
                                <option value="MANAGER">{t('roles.manager')}</option>
                                <option value="HR_ADMIN">{t('roles.hrAdmin')}</option>
                                <option value="SUPER_ADMIN">{t('roles.superAdmin')}</option>
                                <option value="BRANCH_SECRETARY">{t('roles.branchSecretary')}</option>
                                <option value="SUPPORT">{t('roles.support')}</option>
                            </select>
                            <input
                                className="rounded-xl border border-ink/20 bg-slate-50 px-3 py-2 text-ink/70"
                                value="SPHINX@2026"
                                readOnly
                                aria-label={t('defaultPassword')}
                                title={locale === 'ar' ? 'كلمة مرور ثابتة للعرض فقط' : 'Fixed default password for display only'}
                            />
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="btn-outline" onClick={() => setCreateOpen(false)}>{cancelLabel}</button>
                            <button className="btn-primary" onClick={createEmployee}>{t('createCta')}</button>
                        </div>
                    </div>
                </div>
            )}

            {editOpen && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="card w-full max-w-4xl p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{locale === 'ar' ? 'تعديل الموظف' : 'Edit Employee'}</h3>
                            <button className="btn-outline" onClick={() => setEditOpen(false)}>×</button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('fullNameEn')}
                                value={editForm.fullName || ''}
                                onChange={(e) => setEditForm((p: any) => ({ ...p, fullName: e.target.value }))}
                            />
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('fullNameArLabel')}
                                value={editForm.fullNameAr || ''}
                                onChange={(e) => setEditForm((p: any) => ({ ...p, fullNameAr: e.target.value }))}
                            />
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('phone')}
                                inputMode="numeric"
                                maxLength={11}
                                value={editForm.phone || ''}
                                onChange={(e) => setEditForm((p: any) => ({ ...p, phone: normalizePhone(e.target.value) }))}
                            />
                            <select
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                value={editForm.branchId || ''}
                                onChange={(e) => {
                                    const value = e.target.value ? Number(e.target.value) : '';
                                    setEditForm((p: any) => ({ ...p, branchId: value, departmentId: '' }));
                                }}
                            >
                                <option value="">{t('governorate')}</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {locale === 'ar' ? (branch.nameAr || branch.name) : branch.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                value={editForm.departmentId || ''}
                                onChange={(e) => setEditForm((p: any) => ({ ...p, departmentId: e.target.value }))}
                                disabled={!editForm.branchId}
                            >
                                <option value="">{editForm.branchId ? t('department') : t('selectBranchFirst')}</option>
                                {availableEditDepartments.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                            <input
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={t('jobTitle')}
                                value={editForm.jobTitle || ''}
                                onChange={(e) => setEditForm((p: any) => ({ ...p, jobTitle: e.target.value }))}
                            />
                            <select
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                value={editForm.role || 'EMPLOYEE'}
                                onChange={(e) => setEditForm((p: any) => ({ ...p, role: e.target.value }))}
                            >
                                <option value="EMPLOYEE">{t('roles.employee')}</option>
                                <option value="MANAGER">{t('roles.manager')}</option>
                                <option value="HR_ADMIN">{t('roles.hrAdmin')}</option>
                                <option value="SUPER_ADMIN">{t('roles.superAdmin')}</option>
                                <option value="BRANCH_SECRETARY">{t('roles.branchSecretary')}</option>
                                <option value="SUPPORT">{t('roles.support')}</option>
                            </select>
                            <input
                                type="number"
                                min={0}
                                className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                                placeholder={locale === 'ar' ? 'رصيد الإجازات الاعتيادية' : 'Annual leave balance'}
                                value={editForm.annualLeaveDays ?? ''}
                                onChange={(e) => setEditForm((p: any) => ({ ...p, annualLeaveDays: e.target.value }))}
                            />
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="btn-outline" onClick={() => setEditOpen(false)}>{cancelLabel}</button>
                            <button className="btn-primary" onClick={saveEdit} disabled={savingEdit}>
                                {savingEdit ? (locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {statsOpen && statsUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="card w-full max-w-3xl p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">
                                {locale === 'ar' ? 'بيانات الموظف' : 'Employee Overview'} - {statsUser.fullName}
                            </h3>
                            <button className="btn-outline" onClick={() => setStatsOpen(false)}>×</button>
                        </div>
                        {statsLoading ? (
                            <p className="mt-4 text-sm text-ink/60">{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
                        ) : (
                            <div className="mt-4 space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
                                        <p className="text-sm text-ink/60">{locale === 'ar' ? 'رصيد الإجازات المتبقي' : 'Remaining Leave Balance'}</p>
                                        <p className="text-lg font-semibold">{statsData?.remainingAnnual ?? 0}</p>
                                    </div>
                                    <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
                                        <p className="text-sm text-ink/60">{locale === 'ar' ? 'عدد الغيابات' : 'Absences'}</p>
                                        <p className="text-lg font-semibold">{statsData?.absences ?? 0}</p>
                                    </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
                                        <p className="text-sm text-ink/60">{locale === 'ar' ? 'الإجازات' : 'Leaves'}</p>
                                        <p className="text-sm">{locale === 'ar' ? 'الإجمالي' : 'Total'}: {statsData?.leaveCounts?.total ?? 0}</p>
                                        <p className="text-sm">{locale === 'ar' ? 'الموافق عليها' : 'Approved'}: {statsData?.leaveCounts?.approved ?? 0}</p>
                                        <p className="text-sm">{locale === 'ar' ? 'المعلقة' : 'Pending'}: {statsData?.leaveCounts?.pending ?? 0}</p>
                                    </div>
                                    <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
                                        <p className="text-sm text-ink/60">{locale === 'ar' ? 'الأذونات' : 'Permissions'}</p>
                                        <p className="text-sm">{locale === 'ar' ? 'الإجمالي' : 'Total'}: {statsData?.permissionCounts?.total ?? 0}</p>
                                        <p className="text-sm">{locale === 'ar' ? 'الموافق عليها' : 'Approved'}: {statsData?.permissionCounts?.approved ?? 0}</p>
                                        <p className="text-sm">{locale === 'ar' ? 'المعلقة' : 'Pending'}: {statsData?.permissionCounts?.pending ?? 0}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <EmployeeHistoryModal
                open={historyOpen}
                user={historyUser}
                locale={locale}
                onClose={() => { setHistoryOpen(false); setHistoryUser(null); }}
            />
        </main>
    );
}
