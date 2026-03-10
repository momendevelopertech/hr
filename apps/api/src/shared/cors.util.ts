const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

function normalizeOrigin(value: string): string {
    const trimmed = value.trim().replace(/\/+$/, '');
    if (!trimmed) return '';

    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }

    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed);
    return `${isLocal ? 'http' : 'https'}://${trimmed}`;
}

export function getAllowedOrigins(): string[] {
    const raw = [
        process.env.FRONTEND_URL,
        process.env.FRONTEND_URLS,
    ]
        .filter(Boolean)
        .flatMap((value) => (value as string).split(','))
        .map((value) => normalizeOrigin(value))
        .filter(Boolean);

    if (!raw.length) {
        return [DEFAULT_FRONTEND_ORIGIN];
    }

    return [...new Set(raw)];
}

export function corsOriginDelegate(
    requestOrigin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
) {
    const allowedOrigins = getAllowedOrigins();

    if (!requestOrigin) {
        callback(null, true);
        return;
    }

    const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
    if (allowedOrigins.includes(normalizedRequestOrigin)) {
        callback(null, true);
        return;
    }

    callback(new Error(`CORS blocked for origin: ${requestOrigin}`));
}
