import axios from 'axios';
import { getPublicApiUrl } from '@/lib/public-urls';
import { useAuthStore } from '@/stores/auth-store';

let csrfToken: string | null = null;
let refreshPromise: Promise<void> | null = null;
let refreshDisabled = false;
let accessToken: string | null = null;
const activityListeners = new Set<() => void>();

export class AppApiError extends Error {
    constructor(
        public readonly status?: number,
        message = 'Something went wrong. Please try again.',
        public readonly fields?: Record<string, string>,
    ) {
        super(message);
        this.name = 'AppApiError';
    }
}

export const getErrorStatus = (error: unknown): number | undefined => {
    if (!error || typeof error !== 'object') return undefined;
    const maybeAny = error as any;
    const status = maybeAny?.status ?? maybeAny?.response?.status;
    return typeof status === 'number' ? status : undefined;
};

export const isAuthError = (error: unknown): boolean => {
    const status = getErrorStatus(error);
    return status === 401 || status === 403;
};

export const setCsrfToken = (token: string) => {
    csrfToken = token;
};

export const setAccessToken = (token: string | null) => {
    accessToken = token;
};

export const addActivityListener = (listener: () => void) => {
    activityListeners.add(listener);
    return () => {
        activityListeners.delete(listener);
    };
};

const emitActivity = () => {
    if (activityListeners.size === 0) return;
    activityListeners.forEach((listener) => {
        try {
            listener();
        } catch {
            // ignore listener errors
        }
    });
};

const resetRefreshState = () => {
    refreshDisabled = false;
};

const disableRefreshState = () => {
    refreshDisabled = true;
    csrfToken = null;
};

const clearAuthState = () => {
    if (typeof window === 'undefined') return;
    try {
        const { setUser, setBootstrapped } = useAuthStore.getState();
        setUser(null);
        setBootstrapped(false);
    } catch {
        // ignore store errors
    }
};

const markLoggedOut = () => {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem('sphinx-logged-out', '1');
    } catch {
        // ignore storage errors
    }
};

const clearLoggedOut = () => {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem('sphinx-logged-out');
    } catch {
        // ignore storage errors
    }
};

const redirectToLogin = () => {
    if (typeof window === 'undefined') return;
    const segments = window.location.pathname.split('/').filter(Boolean);
    const locale = segments[0] || 'en';
    const target = `/${locale}/login`;
    if (!window.location.pathname.startsWith(target)) {
        window.location.assign(target);
    }
};

const handleSessionExpired = () => {
    disableRefreshState();
    clearApiCache();
    clearAuthState();
    setAccessToken(null);
    markLoggedOut();
    redirectToLogin();
};

const api = axios.create({
    baseURL: getPublicApiUrl(),
    withCredentials: true,
    timeout: 15000,
});

type CachedResponse = {
    timestamp: number;
    status: number;
    statusText: string;
    headers: any;
    data: any;
};

const CACHE_TTL_MS = 30000;
const responseCache = new Map<string, CachedResponse>();

const isAuthEndpoint = (url?: string) => !!url && url.includes('/auth/');

const getCacheKey = (config: any) => {
    const base = config.baseURL ? config.baseURL.replace(/\/$/, '') : '';
    const url = config.url || '';
    const params = config.params ? new URLSearchParams(config.params).toString() : '';
    const suffix = params ? `?${params}` : '';
    return `${config.method || 'get'}:${base}${url}${suffix}`;
};

export const clearApiCache = () => {
    responseCache.clear();
};


export const clearBrowserRuntimeCache = async () => {
    clearApiCache();
    csrfToken = null;
    accessToken = null;

    if (typeof window === 'undefined') return;

    if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
    }

    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(async (registration) => {
            try {
                await registration.update();
            } catch {
                // ignore SW update errors
            }
        }));
    }
};

const defaultAdapter = axios.getAdapter(axios.defaults.adapter);

api.defaults.adapter = async (config) => {
    const method = (config.method || 'get').toLowerCase();
    const skipCache = config.headers?.['x-no-cache'];
    const allowCacheHeader = config.headers?.['x-allow-cache'];
    const explicitAllowCache = allowCacheHeader === '1';
    const shouldUseCache =
        method === 'get' &&
        explicitAllowCache &&
        !skipCache &&
        !isAuthEndpoint(config.url);

    if (shouldUseCache) {
        const key = getCacheKey(config);
        const cached = responseCache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return Promise.resolve({
                data: cached.data,
                status: cached.status,
                statusText: cached.statusText,
                headers: cached.headers,
                config,
                request: {},
            });
        }
    }

    const requestAdapter =
        config.adapter && config.adapter !== api.defaults.adapter
            ? axios.getAdapter(config.adapter)
            : defaultAdapter;
    const response = await requestAdapter(config);

    if (shouldUseCache) {
        const key = getCacheKey(config);
        responseCache.set(key, {
            timestamp: Date.now(),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
        });
    }

    return response;
};

const ensureRefresh = async () => {
    if (refreshDisabled) {
        throw new AppApiError(401, 'Session expired. Please sign in again.');
    }

    if (!refreshPromise) {
        refreshPromise = (async () => {
            if (!csrfToken) {
                await api.get('/auth/csrf', { headers: { 'x-skip-activity': '1' } });
            }

            await api.post('/auth/refresh', {}, { headers: { 'x-skip-activity': '1' } });
        })()
            .then(() => {
                refreshDisabled = false;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
};

export const refreshSession = async () => {
    await ensureRefresh();
};

api.interceptors.request.use((config) => {
    const skipActivity = (config.headers as any)?.['x-skip-activity'] === '1';
    if (!skipActivity && typeof window !== 'undefined') {
        emitActivity();
    }
    if (csrfToken) {
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = csrfToken;
    }
    if (accessToken) {
        config.headers = config.headers || {};
        if (!config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
    }
    return config;
});

api.interceptors.response.use((response) => {
    if (response.config.url?.includes('/auth/csrf') && response.data?.csrfToken) {
        setCsrfToken(response.data.csrfToken);
    }

    if (response.config.url?.includes('/auth/login')) {
        resetRefreshState();
        clearApiCache();
        clearLoggedOut();
        if (response.data?.accessToken) {
            setAccessToken(response.data.accessToken);
        }
    }

    if (response.config.url?.includes('/auth/logout')) {
        disableRefreshState();
        clearApiCache();
        markLoggedOut();
        setAccessToken(null);
    }

    if (response.config.url?.includes('/auth/refresh')) {
        resetRefreshState();
        clearLoggedOut();
        if (response.data?.accessToken) {
            setAccessToken(response.data.accessToken);
        }
    }

    return response;
}, async (error) => {
    const original = error?.config as any;
    const status = error?.response?.status;
    const responseMessage = error?.response?.data?.message;

    if (
        status === 403 &&
        responseMessage === 'Invalid CSRF token' &&
        original &&
        !original._csrfRetry &&
        !original.url?.includes('/auth/csrf')
    ) {
        original._csrfRetry = true;
        await api.get('/auth/csrf');
        return api(original);
    }

    if (
        status === 401 &&
        original &&
        !original._retry &&
        !original.url?.includes('/auth/login') &&
        !original.url?.includes('/auth/logout') &&
        !original.url?.includes('/auth/refresh') &&
        !original.url?.includes('/auth/csrf')
    ) {
        if (refreshDisabled) {
            handleSessionExpired();
            return Promise.reject(new AppApiError(401, 'Session expired. Please sign in again.'));
        }
        original._retry = true;
        try {
            await ensureRefresh();
            return api(original);
        } catch (refreshError: any) {
            const refreshStatus = refreshError?.response?.status;
            if (refreshStatus === 401 || refreshStatus === 403 || refreshStatus === 500) {
                handleSessionExpired();
            }
            return Promise.reject(refreshError);
        }
    }

    if (error?.code === 'ECONNABORTED') {
        return Promise.reject(new AppApiError(undefined, 'Request timed out. Please try again.'));
    }

    if (!error?.response) {
        return Promise.reject(new AppApiError(undefined, 'Network error. Check your connection and retry.'));
    }

    const data = error.response.data || {};
    const defaultMessage = status >= 500
        ? 'Server error. Please try again shortly.'
        : 'Unable to complete your request.';
    const message = typeof data?.message === 'string'
        ? data.message
        : Array.isArray(data?.message)
            ? data.message[0]
            : defaultMessage;

    const fields = Array.isArray(data?.message)
        ? data.message.reduce((acc: Record<string, string>, msg: string) => {
            const parts = msg.split(' ');
            if (parts.length > 1) {
                acc[parts[0]] = msg;
            }
            return acc;
        }, {})
        : undefined;

    return Promise.reject(new AppApiError(status, message, fields));
});

export default api;
