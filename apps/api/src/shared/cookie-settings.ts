type CookieSameSite = 'lax' | 'none';

const hasScheme = (value: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
const isLocalhost = (value: string) => /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(value);

const normalizeOrigin = (value?: string) => {
    if (!value) return 'http://localhost:3000';
    const trimmed = value.trim();
    if (!trimmed) return 'http://localhost:3000';
    if (hasScheme(trimmed)) return trimmed;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (isLocalhost(trimmed)) return `http://${trimmed.replace(/^https?:\/\//i, '')}`;
    return `https://${trimmed}`;
};

export const getFrontendOrigin = () => normalizeOrigin(process.env.FRONTEND_URL);

export const getAllowedOrigins = () => {
    const primary = getFrontendOrigin();
    const origins = new Set([primary]);

    if (isLocalhost(primary)) {
        try {
            const url = new URL(primary);
            const port = url.port || (url.protocol === 'https:' ? '443' : '80');
            origins.add(`${url.protocol}//localhost:${port}`);
            origins.add(`${url.protocol}//127.0.0.1:${port}`);
            origins.add(`${url.protocol}//[::1]:${port}`);
        } catch {
            // ignore malformed URL
        }
    }

    return Array.from(origins);
};

export const getCookieSettings = () => {
    const frontendOrigin = getFrontendOrigin();
    const isLocal = isLocalhost(frontendOrigin);
    const isHttps = frontendOrigin.startsWith('https://');

    if (!isLocal && !isHttps) {
        return { sameSite: 'lax' as CookieSameSite, secure: false };
    }

    return {
        sameSite: (isLocal ? 'lax' : 'none') as CookieSameSite,
        secure: !isLocal,
    };
};
