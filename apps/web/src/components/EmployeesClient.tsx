'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [statsOpen, setStatsOpen] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsUser, setStatsUser] = useState<User | null>(null);
    const [statsData, setStatsData] = useState<any | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyUser, setHistoryUser] = useState<User | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [dialog, setDialog] = useState<{
        title?: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm: () => void;
    } | null>(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState<any>({
        search: '',
        branchId: '',
        departmentId: '',
        status: '',
        from: '',
        to: '',
    });

    const debouncedSearch = useDebouncedValue(filters.search, 400);
    const initialLoadRef = useRef(true);

    const cancelLabel = locale === 'ar' ? 'إلغاء' : 'Cancel';
    const resetLabel = t('resetData');
    const canAdmin = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
    const canViewEmployees = canAdmin || user?.role === 'MANAGER' || user?.role === 'BRANCH_SECRETARY';
    const phoneValidationMessage = t('phoneInvalid');

    const normalizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 11);
    const isValidPhone = (value?: string) => !value || /^\d{11}$/.test(value);
    const canDeleteEmployee = (emp: User) => {
        if (!canAdmin || !user) return false;
        if (emp.id === user.id) return false;
        if (user.role === 'HR_ADMIN' && (emp.role === 'HR_ADMIN' || emp.role === 'SUPER_ADMIN')) {
            return false;
        }
        return true;
    };

    const queryParams = useMemo(() => ({
        page,
        limit,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
    }), [debouncedSearch, filters.branchId, filters.departmentId, filters.from, filters.status, filters.to, limit, page]);

    const availableFilterDepartments = useMemo(() => {
        if (!filters.branchId) return departments;
        return departments.filter((dept) => dept.branches?.some((branch) => branch.id === filters.branchId));
    }, [departments, filters.branchId]);

    const availableDepartments = useMemo(() => {
        if (!form.branchId) return [];
        return departments.filter((dept) => dept.branches?.some((branch) => branch.id === form.branchId));
    }, [departments, form.branchId]);

    const availableEditDepartments = useMemo(() => {
        if (!editForm.branchId) return [];
        return departments.filter((dept) => dept.branches?.some((branch) => branch.id === editForm.branchId));
    }, [departments, editForm.branchId]);

    const fetchAll = useCallback(async () => {
        const isInitial = initialLoadRef.current;
        if (isInitial) setLoading(true);
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
            if (isInitial) {
                setLoading(false);
                initialLoadRef.current = false;
            }
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

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    const showNotice = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        setNotice({ message, type });
        setTimeout(() => setNotice((current) => (current?.message === message ? null : current)), 4500);
    };

    const openConfirm = (message: string, onConfirm: () => void, title?: string, confirmLabel?: string) => {
        setDialog({
            title,
            message,
            confirmLabel: confirmLabel || (locale === 'ar' ? 'تأكيد' : 'Confirm'),
            cancelLabel,
            onConfirm,
        });
    };

    if (!ready || loading) {
        return <PageLoader text={locale === 'ar' ? 'جاري تحميل الموظفين...' : 'Loading employees...'} />;
    }
    if (!canViewEmployees) return null;

    const createEmployee = async () => {
        if (!isValidPhone(form.phone)) {
            showNotice(phoneValidationMessage, 'error');
            return;
        }
        const role = form.role || 'EMPLOYEE';
        if (!form.branchId) {
            showNotice(locale === 'ar' ? 'يجب اختيار الفرع.' : 'Branch is required.', 'error');
            return;
        }
        const departmentRequired = role === 'EMPLOYEE' || role === 'MANAGER';
        if (departmentRequired && !form.departmentId) {
            showNotice(locale === 'ar' ? 'يجب اختيار القسم.' : 'Department is required.', 'error');
            return;
        }
        if (!form.jobTitle) {
            showNotice(locale === 'ar' ? 'يجب إدخال المسمى الوظيفي.' : 'Job title is required.', 'error');
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

        const whatsAppWarning = res.data?.whatsAppDelivery && !res.data.whatsAppDelivery.ok
            ? (locale === 'ar'
                ? `\nتعذر إرسال واتساب: ${res.data.whatsAppDelivery.error || 'فشل غير معروف'}`
                : `\nWhatsApp delivery failed: ${res.data.whatsAppDelivery.error || 'Unknown failure'}`)
            : '';
        const msg = locale === 'ar'
            ? `تم إنشاء المستخدم بنجاح. اسم المستخدم: ${res.data.generatedUsername} | كلمة المرور: ${res.data.defaultPassword}${whatsAppWarning}`
            : `Employee created successfully. Username: ${res.data.generatedUsername} | Password: ${res.data.defaultPassword}${whatsAppWarning}`;
        showNotice(msg, 'success');

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
            showNotice(phoneValidationMessage, 'error');
            return;
        }
        const role = editForm.role || 'EMPLOYEE';
        if (!editForm.branchId) {
            showNotice(locale === 'ar' ? 'يجب اختيار الفرع.' : 'Branch is required.', 'error');
            return;
        }
        const departmentRequired = role === 'EMPLOYEE' || role === 'MANAGER';
        if (departmentRequired && !editForm.departmentId) {
            showNotice(locale === 'ar' ? 'يجب اختيار القسم.' : 'Department is required.', 'error');
            return;
        }
        if (!editForm.jobTitle) {
            showNotice(locale === 'ar' ? 'يجب إدخال المسمى الوظيفي.' : 'Job title is required.', 'error');
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
            showNotice(locale === 'ar' ? 'تم حفظ التعديلات.' : 'Changes saved.', 'success');
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
        await fetchAll();
    };

    const resetEmployeeData = async (emp: User) => {
        const confirmText = locale === 'ar'
            ? 'هل أنت متأكد من مسح جميع بيانات الموظف؟ سيتم حذف الإجازات والأذونات والطلبات والسجلات.'
            : 'Are you sure you want to delete all employee data? This will remove leaves, permissions, requests, and records.';
        openConfirm(confirmText, async () => {
            await api.post(`/users/${emp.id}/reset-data`);
            showNotice(locale === 'ar' ? 'تم مسح بيانات الموظف بنجاح.' : 'Employee data has been reset.', 'success');
            await fetchAll();
        }, locale === 'ar' ? 'تأكيد مسح البيانات' : 'Confirm data reset', resetLabel);
    };

    const deleteEmployee = (emp: User) => {
        if (!canDeleteEmployee(emp)) {
            showNotice(t('deleteProtected'), 'error');
            return;
        }

        openConfirm(
            t('deleteConfirm'),
            async () => {
                setDeletingId(emp.id);
                try {
                    await api.delete(`/users/${emp.id}`);
                    showNotice(t('deleteSuccess'), 'success');

                    if (editingUser?.id === emp.id) {
                        setEditOpen(false);
                        setEditingUser(null);
                        setEditForm({});
                    }
                    if (statsUser?.id === emp.id) {
                        setStatsOpen(false);
                        setStatsUser(null);
                        setStatsData(null);
                    }
                    if (historyUser?.id === emp.id) {
                        setHistoryOpen(false);
                        setHistoryUser(null);
                    }

                    if (employees.length === 1 && page > 1) {
                        setPage((current) => Math.max(1, current - 1));
                    } else {
                        await fetchAll();
                    }
                } catch (error) {
                    const err = error as { message?: string };
                    showNotice(err.message || t('deleteFailed'), 'error');
                } finally {
                    setDeletingId(null);
                }
            },
            locale === 'ar' ? 'تأكيد حذف الموظف' : 'Confirm delete',
            t('delete'),
        );
    };

    return (
        <main className="space-y-6 px-4 pb-12 sm:px-6">
            {notice && (
                <div className={`fixed z-50 top-4 ${locale === 'ar' ? 'left-4' : 'right-4'} max-w-md`}>
                    <div
                        className={`rounded-xl px-4 py-3 shadow-lg text-sm border ${
                            notice.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : notice.type === 'error'
                                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                                    : 'bg-white border-ink/10 text-ink'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 text-lg">{notice.type === 'success' ? '✅' : notice.type === 'error' ? '⚠️' : 'ℹ️'}</span>
                            <p className="flex-1 whitespace-pre-line">{notice.message}</p>
                            <button className="text-ink/50 hover:text-ink" onClick={() => setNotice(null)}>×</button>
                        </div>
                    </div>
                </div>
            )}

            {dialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="card w-full max-w-lg p-6 space-y-4">
                        {dialog.title && <h3 className="text-lg font-semibold">{dialog.title}</h3>}
                        <p className="text-sm text-ink/80 whitespace-pre-line">{dialog.message}</p>
                        <div className="flex justify-end gap-2">
                            <button className="btn-outline" onClick={() => setDialog(null)}>{dialog.cancelLabel || cancelLabel}</button>
                            <button
                                className="btn-danger"
                                onClick={() => {
                                    dialog.onConfirm();
                                    setDialog(null);
                                }}
                            >
                                {dialog.confirmLabel || (locale === 'ar' ? 'تأكيد' : 'Confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <section className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 pb-4">
                    <div className="space-y-2">
                        <h2 className="text-lg font-semibold">{t('title')}</h2>
                        <div className="inline-flex items-center rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-ink/60">
                            {t('records', { count: total })}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-sm text-ink/70">
                            {t('rowsPerPage')}
                            <select
                                className="ms-2 rounded-lg border border-ink/20 bg-white px-2 py-1"
                                value={limit}
                                onChange={(e) => {
                                    setPage(1);
                                    setLimit(parseInt(e.target.value, 10));
                                }}
                            >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </label>
                        {canAdmin && (
                            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
                                {t('createCta')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                    <input
                        className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                        placeholder={t('searchPlaceholder')}
                        value={filters.search}
                        onChange={(e) => setFilters((p: any) => ({ ...p, search: e.target.value }))}
                    />
                    <select
                        className="rounded-xl border border-ink/20 bg-white px-3 py-2"
                        value={filters.branchId || ''}
                        onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : '';
                            setPage(1);
                            setFilters((p: any) => ({ ...p, branchId: value, departmentId: '' }));
                        }}
                    >
                        <option value="">{t('governorate')}</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {locale === 'ar' ? (branch.nameAr || branch.name) : branch.name}
                            </option>
                        ))}
                    </select>
                    <select className="rounded-xl border border-ink/20 bg-white px-3 py-2" value={filters.departmentId} onChange={(e) => { setPage(1); setFilters((p: any) => ({ ...p, departmentId: e.target.value })); }}>
                        <option value="">{t('department')}</option>
                        {availableFilterDepartments.map((d) => (
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
                                                    className="btn-outline"
                                                    onClick={() => openStats(emp)}
                                                >
                                                    {t('view')}
                                                </button>
                                                <button
                                                    className="btn-outline"
                                                    onClick={() => openHistory(emp)}
                                                >
                                                    {t('history')}
                                                </button>
                                                {canAdmin && (
                                                    <button
                                                        className="btn-outline"
                                                        onClick={() => openEdit(emp)}
                                                    >
                                                        {t('edit')}
                                                    </button>
                                                )}
                                                {canAdmin && (
                                                    <button
                                                        className={emp.isActive ? 'btn-danger' : 'btn-success'}
                                                        onClick={() => toggleActive(emp)}
                                                    >
                                                        {emp.isActive ? t('deactivate') : t('activate')}
                                                    </button>
                                                )}
                                                {canAdmin && (
                                                    <button
                                                        className="btn-danger"
                                                        onClick={() => resetEmployeeData(emp)}
                                                    >
                                                        {resetLabel}
                                                    </button>
                                                )}
                                                {canAdmin && canDeleteEmployee(emp) && (
                                                    <button
                                                        className="btn-danger"
                                                        onClick={() => deleteEmployee(emp)}
                                                        disabled={deletingId === emp.id}
                                                    >
                                                        {deletingId === emp.id
                                                            ? (locale === 'ar' ? 'جارٍ الحذف...' : 'Deleting...')
                                                            : t('delete')}
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
                            <div className="space-y-1">
                                <input className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2" placeholder={t('phone')}
                                    inputMode="numeric"
                                    maxLength={11}
                                    title={t('phoneHint')}
                                    value={form.phone || ''}
                                    onChange={(e) => setForm((p: any) => ({ ...p, phone: normalizePhone(e.target.value) }))} />
                                <p className="text-xs text-ink/60">{t('phoneHint')}</p>
                            </div>
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
                            <div className="space-y-1">
                                <input
                                    className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    placeholder={t('phone')}
                                    inputMode="numeric"
                                    maxLength={11}
                                    title={t('phoneHint')}
                                    value={editForm.phone || ''}
                                    onChange={(e) => setEditForm((p: any) => ({ ...p, phone: normalizePhone(e.target.value) }))}
                                />
                                <p className="text-xs text-ink/60">{t('phoneHint')}</p>
                            </div>
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
