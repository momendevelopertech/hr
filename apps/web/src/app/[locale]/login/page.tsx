'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Eye, EyeOff, Languages, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { AppApiError, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import BrandLogo from '@/components/BrandLogo';

const REMEMBER_KEY = 'sphinx-remember-me';
const IDENTIFIER_KEY = 'sphinx-remember-identifier';

type Branch = { id: number; name: string; nameAr?: string | null };
type Department = {
    id: string;
    name: string;
    nameAr?: string | null;
    branches?: Branch[];
};

type RegisterFormState = {
    fullName: string;
    fullNameAr: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    branchId: string;
    departmentId: string;
    jobTitle: string;
    jobTitleAr: string;
};

type ChannelDelivery = {
    ok: boolean;
    recipient?: string;
    phone?: string;
    error?: string;
};

const defaultRegisterForm: RegisterFormState = {
    fullName: '',
    fullNameAr: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    branchId: '',
    departmentId: '',
    jobTitle: '',
    jobTitleAr: '',
};

const hasSessionHintCookie = () => {
    if (typeof document === 'undefined') return false;
    return document.cookie.split(';').some((item) => item.trim().startsWith('sphinx_session='));
};

const englishFullNamePattern = /^[A-Za-z][A-Za-z\s.'-]{2,}$/;
const englishJobTitlePattern = /^[A-Za-z0-9][A-Za-z0-9\s.'&()/,-]{1,}$/;
const normalizePhoneInput = (value: string) => value.replace(/\D/g, '').slice(0, 11);

export default function LoginPage({ params }: { params: { locale: 'en' | 'ar' } }) {
    const t = useTranslations('auth');
    const router = useRouter();
    const pathname = usePathname();
    const { setUser, setBootstrapped } = useAuthStore();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [identifier, setIdentifier] = useState(() => {
        if (typeof window === 'undefined') return '';
        const storedRemember = window.localStorage.getItem(REMEMBER_KEY);
        if (storedRemember === '0') return '';
        return window.localStorage.getItem(IDENTIFIER_KEY) || '';
    });
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(() => {
        if (typeof window === 'undefined') return true;
        const stored = window.localStorage.getItem(REMEMBER_KEY);
        return stored ? stored === '1' : true;
    });
    const [checkingSession, setCheckingSession] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [showRegisterPassword, setShowRegisterPassword] = useState(false);
    const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);
    const [loginPending, setLoginPending] = useState(false);
    const [registerPending, setRegisterPending] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [registerForm, setRegisterForm] = useState<RegisterFormState>(defaultRegisterForm);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loadingRegisterOptions, setLoadingRegisterOptions] = useState(false);
    const [loadedRegisterOptions, setLoadedRegisterOptions] = useState(false);
    const loginSubmitLockRef = useRef(false);
    const registerSubmitLockRef = useRef(false);

    const loginBusy = checkingSession || loginPending;
    const registerBusy = checkingSession || registerPending || loadingRegisterOptions;
    const authFlowLocked = checkingSession || loginPending || registerPending;
    const loading = loginPending || registerPending;

    useEffect(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null;
        const next = stored === 'dark' ? 'dark' : 'light';
        setTheme(next);
        if (typeof document !== 'undefined') {
            document.documentElement.dataset.theme = next;
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(REMEMBER_KEY, rememberMe ? '1' : '0');
        if (!rememberMe) {
            window.localStorage.removeItem(IDENTIFIER_KEY);
        }
    }, [rememberMe]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!rememberMe) return;
        const trimmed = identifier.trim();
        if (!trimmed) {
            window.localStorage.removeItem(IDENTIFIER_KEY);
            return;
        }
        window.localStorage.setItem(IDENTIFIER_KEY, trimmed);
    }, [identifier, rememberMe]);

    const availableDepartments = useMemo(() => {
        if (!registerForm.branchId) return [];
        return departments.filter((department) => department.branches?.some((branch) => String(branch.id) === registerForm.branchId));
    }, [departments, registerForm.branchId]);

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        if (typeof document !== 'undefined') {
            document.documentElement.dataset.theme = next;
        }
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('theme', next);
        }
    };

    const switchLocale = (nextLocale: string) => {
        const segments = pathname.split('/');
        segments[1] = nextLocale;
        router.push(segments.join('/'));
    };

    const redirectForRole = useCallback(
        (role?: string) => {
            const target = role === 'MANAGER' || role === 'BRANCH_SECRETARY' ? `/${params.locale}/requests` : `/${params.locale}`;
            router.push(target);
            setTimeout(() => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
                    window.location.href = target;
                }
            }, 600);
        },
        [params.locale, router],
    );

    useEffect(() => {
        let active = true;
        const boot = async () => {
            try {
                if (typeof window !== 'undefined' && window.sessionStorage.getItem('sphinx-logged-out') === '1') {
                    return;
                }
                if (!hasSessionHintCookie()) {
                    return;
                }
                await api.get('/auth/csrf');
                const res = await api.get('/auth/me');
                if (!active) return;
                if (typeof window !== 'undefined') {
                    window.sessionStorage.removeItem('sphinx-logged-out');
                }
                setUser(res.data);
                setBootstrapped(true);
                redirectForRole(res.data?.role);
                return;
            } catch {
                // ignore, user is not authenticated
            } finally {
                if (active) setCheckingSession(false);
            }
        };
        boot();
        return () => {
            active = false;
        };
    }, [redirectForRole, setBootstrapped, setUser]);

    const loadRegistrationOptions = useCallback(async () => {
        if (loadedRegisterOptions || loadingRegisterOptions) return;
        setLoadingRegisterOptions(true);
        try {
            const res = await api.get('/auth/registration-options');
            setBranches(res.data?.branches || []);
            setDepartments(res.data?.departments || []);
            setLoadedRegisterOptions(true);
        } finally {
            setLoadingRegisterOptions(false);
        }
    }, [loadedRegisterOptions, loadingRegisterOptions]);

    useEffect(() => {
        if (mode !== 'register') return;
        loadRegistrationOptions();
    }, [loadRegistrationOptions, mode]);

    const validateLogin = () => {
        const nextErrors: Record<string, string> = {};
        if (!identifier.trim()) {
            nextErrors.identifier = t('loginEmailRequired');
        }
        if (!password.trim()) {
            nextErrors.password = t('loginPasswordRequired');
        } else if (password.trim().length < 6) {
            nextErrors.password = t('loginPasswordShort');
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const validateRegister = () => {
        const nextErrors: Record<string, string> = {};
        const phoneDigits = registerForm.phone.replace(/\D/g, '');
        const normalizedFullName = registerForm.fullName.trim().replace(/\s+/g, ' ');
        const normalizedJobTitle = registerForm.jobTitle.trim().replace(/\s+/g, ' ');

        if (!normalizedFullName) {
            nextErrors.fullName = t('registerFullNameRequired');
        } else if (!englishFullNamePattern.test(normalizedFullName)) {
            nextErrors.fullName = t('registerFullNameEnglishOnly');
        }
        if (!registerForm.email.trim()) nextErrors.email = t('registerEmailRequired');
        if (!registerForm.password.trim()) {
            nextErrors.registerPassword = t('registerPasswordRequired');
        } else if (registerForm.password.trim().length < 8) {
            nextErrors.registerPassword = t('registerPasswordShort');
        }
        if (!registerForm.confirmPassword.trim()) {
            nextErrors.confirmPassword = t('registerConfirmPasswordRequired');
        } else if (registerForm.password !== registerForm.confirmPassword) {
            nextErrors.confirmPassword = t('passwordMismatch');
        }
        if (!phoneDigits) {
            nextErrors.phone = t('registerPhoneRequired');
        } else if (phoneDigits.length !== 11) {
            nextErrors.phone = t('registerPhoneInvalid');
        }
        if (!registerForm.branchId) nextErrors.branchId = t('registerBranchRequired');
        if (!registerForm.departmentId) nextErrors.departmentId = t('registerDepartmentRequired');
        if (!normalizedJobTitle) {
            nextErrors.jobTitle = t('registerJobTitleRequired');
        } else if (!englishJobTitlePattern.test(normalizedJobTitle)) {
            nextErrors.jobTitle = t('registerJobTitleEnglishOnly');
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const formatLoginError = (error: unknown) => {
        const err = error as AppApiError;

        if (!err?.status) return t('loginNetworkError');
        if (err.status === 401) return t('loginInvalid');
        if (err.status === 403) {
            if (err.message?.toLowerCase().includes('locked')) return t('loginLocked');
            if (err.message?.toLowerCase().includes('deactivated')) return t('loginDeactivated');
            return t('loginForbidden');
        }
        if (err.status === 429) return t('loginTooMany');
        if (err.status >= 500) return t('loginServerError');

        return err.message || t('loginUnknownError');
    };

    const showRegisterDeliveryToasts = (response: {
        emailDelivery?: ChannelDelivery | null;
        whatsAppDelivery?: ChannelDelivery | null;
        user?: { email?: string | null; phone?: string | null };
    }) => {
        const emailDelivery = response.emailDelivery;
        const whatsAppDelivery = response.whatsAppDelivery;
        const unknownReason = t('registerDeliveryUnknownFailure');

        if (!emailDelivery && !whatsAppDelivery) {
            return;
        }

        if (emailDelivery?.ok) {
            toast.success(t('registerEmailSent', {
                recipient: emailDelivery.recipient || response.user?.email || '-',
            }), { duration: 7000 });
        } else if (emailDelivery) {
            toast.error(t('registerEmailFailed', {
                recipient: emailDelivery.recipient || response.user?.email || '-',
                reason: emailDelivery.error || unknownReason,
            }), { duration: 9000 });
        }

        if (whatsAppDelivery?.ok) {
            toast.success(t('registerWhatsAppSent', {
                phone: whatsAppDelivery.phone || response.user?.phone || '-',
            }), { duration: 7000 });
        } else if (whatsAppDelivery) {
            toast.error(t('registerWhatsAppFailed', {
                phone: whatsAppDelivery.phone || response.user?.phone || '-',
                reason: whatsAppDelivery.error || unknownReason,
            }), { duration: 9000 });
        }
    };

    const submitLogin = async () => {
        if (loginSubmitLockRef.current || authFlowLocked || !validateLogin()) return;
        loginSubmitLockRef.current = true;
        setLoginPending(true);
        setErrors({});
        try {
            await api.get('/auth/csrf');
            const res = await api.post('/auth/login', {
                identifier: identifier.trim(),
                password,
                rememberMe,
            });
            setUser(res.data.user);
            setBootstrapped(true);
            if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem('sphinx-logged-out');
                window.localStorage.setItem(REMEMBER_KEY, rememberMe ? '1' : '0');
                if (rememberMe) {
                    window.localStorage.setItem(IDENTIFIER_KEY, identifier.trim());
                } else {
                    window.localStorage.removeItem(IDENTIFIER_KEY);
                }
            }
            redirectForRole(res.data?.user?.role);
        } catch (error) {
            setErrors({ form: formatLoginError(error) });
        } finally {
            loginSubmitLockRef.current = false;
            setLoginPending(false);
        }
    };

    const submitRegister = async () => {
        if (registerSubmitLockRef.current || authFlowLocked || loadingRegisterOptions || !validateRegister()) return;
        registerSubmitLockRef.current = true;
        setRegisterPending(true);
        setErrors({});
        try {
            await api.get('/auth/csrf');
            const res = await api.post('/auth/register', {
                fullName: registerForm.fullName.trim().replace(/\s+/g, ' '),
                fullNameAr: registerForm.fullNameAr.trim() || undefined,
                email: registerForm.email.trim(),
                phone: normalizePhoneInput(registerForm.phone),
                password: registerForm.password,
                branchId: Number(registerForm.branchId),
                departmentId: registerForm.departmentId,
                jobTitle: registerForm.jobTitle.trim().replace(/\s+/g, ' '),
                jobTitleAr: registerForm.jobTitleAr.trim() || undefined,
            });
            if (res.data?.accessToken) {
                setAccessToken(res.data.accessToken);
            }
            setUser(res.data.user);
            setBootstrapped(true);
            if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem('sphinx-logged-out');
            }
            showRegisterDeliveryToasts(res.data);
            redirectForRole(res.data?.user?.role);
        } catch (error) {
            const err = error as AppApiError;
            setErrors({ registerForm: err.message || t('registerFailed') });
        } finally {
            registerSubmitLockRef.current = false;
            setRegisterPending(false);
        }
    };

    const updateRegisterField = (field: keyof RegisterFormState, value: string) => {
        setRegisterForm((prev) => {
            const next = {
                ...prev,
                [field]: field === 'phone' ? normalizePhoneInput(value) : value,
            };
            if (field === 'branchId') {
                next.departmentId = '';
            }
            return next;
        });
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center px-4 py-8 sm:px-6">
            <div className="absolute end-4 top-4 flex items-center gap-2">
                <button className="btn-outline text-xs sm:text-sm" onClick={() => switchLocale(params.locale === 'ar' ? 'en' : 'ar')} title={params.locale === 'ar' ? 'English' : 'العربية'} aria-label={params.locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
                    <Languages size={16} />
                </button>
                <button className="btn-outline text-xs sm:text-sm" onClick={toggleTheme} title={theme === 'dark' ? 'Light' : 'Dark'} aria-label={theme === 'dark' ? 'Light' : 'Dark'}>
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
            </div>
            <div className="card w-full max-w-xl p-5 sm:p-8">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex justify-center">
                        <BrandLogo locale={params.locale} />
                    </div>
                    <h1 className="text-xl font-semibold sm:text-2xl">{t('welcome')}</h1>
                    <p className="text-sm text-ink/60">{mode === 'login' ? t('loginHint') : t('registerHint')}</p>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-ink/10 bg-ink/5 p-1">
                    <button
                        type="button"
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-white shadow-sm' : 'text-ink/70'}`}
                        disabled={authFlowLocked}
                        onClick={() => {
                            setErrors({});
                            setMode('login');
                        }}
                    >
                        {t('login')}
                    </button>
                    <button
                        type="button"
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === 'register' ? 'bg-white shadow-sm' : 'text-ink/70'}`}
                        disabled={authFlowLocked}
                        onClick={() => {
                            setErrors({});
                            setMode('register');
                        }}
                    >
                        {t('register')}
                    </button>
                </div>

                {mode === 'login' ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            submitLogin();
                        }}
                        className="space-y-4"
                        aria-busy={loginBusy}
                    >
                        <fieldset className="m-0 min-w-0 space-y-4 border-0 p-0" disabled={loginBusy}>
                            <label className="text-sm">
                                {params.locale === 'ar' ? 'البريد الإلكتروني / اسم المستخدم' : 'Email / Username'}
                                <input type="text" name="identifier" autoComplete="username" className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required aria-invalid={!!errors.identifier} />
                                {errors.identifier && <p className="mt-1 text-xs text-red-600">{errors.identifier}</p>}
                            </label>
                            <label className="text-sm">
                                {t('password')}
                                <div className="relative mt-1">
                                    <input type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2 pe-11" value={password} onChange={(e) => setPassword(e.target.value)} required aria-invalid={!!errors.password} />
                                    <button type="button" className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-ink/60" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                                {t('rememberMe')}
                            </label>
                            <button className="btn-primary w-full" type="submit" disabled={loginBusy} aria-busy={loginBusy}>
                                {loading ? (params.locale === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing in...') : checkingSession ? (params.locale === 'ar' ? 'جارٍ التحقق...' : 'Checking session...') : t('login')}
                            </button>
                        </fieldset>
                        <div className="flex items-center justify-between text-sm">
                            <Link className="text-ink/70 hover:text-ink" href={`/${params.locale}/forgot-password`}>
                                {t('reset')}
                            </Link>
                        </div>
                        {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
                    </form>
                ) : (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            submitRegister();
                        }}
                        className="space-y-4"
                        aria-busy={registerBusy}
                    >
                        <fieldset className="m-0 min-w-0 space-y-4 border-0 p-0" disabled={checkingSession || registerPending}>
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                <p className="font-semibold">{t('registerSandboxTitle')}</p>
                                <p className="mt-1">{t('registerSandboxHint')}</p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="text-sm">
                                    {t('registerFullNameEn')}
                                    <input type="text" className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" value={registerForm.fullName} onChange={(e) => updateRegisterField('fullName', e.target.value)} />
                                    {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
                                </label>
                                <label className="text-sm">
                                    {t('registerFullNameAr')}
                                    <input type="text" className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" value={registerForm.fullNameAr} onChange={(e) => updateRegisterField('fullNameAr', e.target.value)} />
                                </label>
                                <label className="text-sm">
                                    {t('registerEmail')}
                                    <input type="email" className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" value={registerForm.email} onChange={(e) => updateRegisterField('email', e.target.value)} />
                                    {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                                </label>
                                <label className="text-sm">
                                    {t('registerPhone')}
                                    <input type="tel" inputMode="numeric" maxLength={11} className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" value={registerForm.phone} onChange={(e) => updateRegisterField('phone', e.target.value)} />
                                    <p className="mt-1 text-xs text-ink/60">{t('registerPhoneHint')}</p>
                                    {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                                </label>
                                <label className="text-sm">
                                    {t('registerJobTitleEn')}
                                    <input type="text" className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" value={registerForm.jobTitle} onChange={(e) => updateRegisterField('jobTitle', e.target.value)} />
                                    {errors.jobTitle && <p className="mt-1 text-xs text-red-600">{errors.jobTitle}</p>}
                                </label>
                                <label className="text-sm">
                                    {t('registerJobTitleAr')}
                                    <input type="text" className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" value={registerForm.jobTitleAr} onChange={(e) => updateRegisterField('jobTitleAr', e.target.value)} />
                                </label>
                                <label className="text-sm">
                                    {t('registerBranch')}
                                    <select className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" value={registerForm.branchId} onChange={(e) => updateRegisterField('branchId', e.target.value)} disabled={loadingRegisterOptions}>
                                        <option value="">{loadingRegisterOptions ? t('registerLoadingOptions') : t('registerSelectBranch')}</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {params.locale === 'ar' ? branch.nameAr || branch.name : branch.name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.branchId && <p className="mt-1 text-xs text-red-600">{errors.branchId}</p>}
                                </label>
                                <label className="text-sm">
                                    {t('registerDepartment')}
                                    <select className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2" value={registerForm.departmentId} onChange={(e) => updateRegisterField('departmentId', e.target.value)} disabled={!registerForm.branchId || loadingRegisterOptions}>
                                        <option value="">{registerForm.branchId ? t('registerSelectDepartment') : t('registerSelectBranchFirst')}</option>
                                        {availableDepartments.map((department) => (
                                            <option key={department.id} value={department.id}>
                                                {params.locale === 'ar' ? department.nameAr || department.name : department.name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.departmentId && <p className="mt-1 text-xs text-red-600">{errors.departmentId}</p>}
                                </label>
                                <label className="text-sm">
                                    {t('newPassword')}
                                    <div className="relative mt-1">
                                        <input type={showRegisterPassword ? 'text' : 'password'} className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2 pe-11" value={registerForm.password} onChange={(e) => updateRegisterField('password', e.target.value)} />
                                        <button type="button" className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-ink/60" onClick={() => setShowRegisterPassword((value) => !value)} aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}>
                                            {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {errors.registerPassword && <p className="mt-1 text-xs text-red-600">{errors.registerPassword}</p>}
                                </label>
                                <label className="text-sm">
                                    {t('confirmPassword')}
                                    <div className="relative mt-1">
                                        <input type={showRegisterConfirm ? 'text' : 'password'} className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2 pe-11" value={registerForm.confirmPassword} onChange={(e) => updateRegisterField('confirmPassword', e.target.value)} />
                                        <button type="button" className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-ink/60" onClick={() => setShowRegisterConfirm((value) => !value)} aria-label={showRegisterConfirm ? 'Hide password' : 'Show password'}>
                                            {showRegisterConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                                </label>
                            </div>

                            <button className="btn-primary w-full" type="submit" disabled={registerBusy} aria-busy={registerBusy}>
                                {loading ? (params.locale === 'ar' ? 'جارٍ إنشاء الحساب...' : 'Creating account...') : t('register')}
                            </button>
                        </fieldset>
                        {errors.registerForm && <p className="text-sm text-red-600">{errors.registerForm}</p>}
                    </form>
                )}
            </div>
        </div>
    );
}
