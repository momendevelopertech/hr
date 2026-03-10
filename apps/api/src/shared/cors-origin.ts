import { getFrontendOrigin } from './cookie-settings';

type OriginCallback = (err: Error | null, allow?: boolean) => void;

const hasScheme = (value: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

const toOriginSet = () => {
    const configured = getFrontendOrigin().trim().replace(/\/$/, '');
    const normalized = new Set<string>([configured]);

    if (hasScheme(configured)) {
        const withoutScheme = configured.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
        normalized.add(`https://${withoutScheme}`);
        normalized.add(`http://${withoutScheme}`);
    }

    return normalized;
};

const allowedOrigins = toOriginSet();

export const socketCorsOrigin = (origin: string | undefined, callback: OriginCallback) => {
    // Allow non-browser clients and server-side requests.
    if (!origin) {
        callback(null, true);
        return;
    }

    const normalizedOrigin = origin.trim().replace(/\/$/, '');
    callback(null, allowedOrigins.has(normalizedOrigin));
};
