import axios from 'axios';
import { getPublicApiUrl } from './public-urls';

let csrfToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

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

export const setCsrfToken = (token: string) => {
    csrfToken = token;
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

api.defaults.adapter = async (config) => {
    const method = (config.method || 'get').toLowerCase();
    const skipCache = config.headers?.['x-no-cache'];

    if (method === 'get' && !skipCache) {
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

    const adapter = axios.getAdapter(config.adapter || axios.defaults.adapter);
    const response = await adapter(config);

    if (method === 'get' && !skipCache) {
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
    if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh', {})
            .then(() => undefined)
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
};

api.interceptors.request.use((config) => {
    if (csrfToken) {
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
});

api.interceptors.response.use((response) => {
    if (response.config.url?.includes('/auth/csrf') && response.data?.csrfToken) {
        setCsrfToken(response.data.csrfToken);
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
        !original.url?.includes('/auth/refresh') &&
        !original.url?.includes('/auth/csrf')
    ) {
        original._retry = true;
        await ensureRefresh();
        return api(original);
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
