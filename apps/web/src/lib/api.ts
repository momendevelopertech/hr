import axios from 'axios';

let csrfToken: string | null = null;

export const setCsrfToken = (token: string) => {
    csrfToken = token;
};

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    withCredentials: true,
});

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
});

export default api;
