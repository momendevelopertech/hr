export const assertSecurityEnv = (isProd: boolean) => {
    if (!isProd) return;

    const missing: string[] = [];
    const hasJwtPrivate = !!process.env.JWT_PRIVATE_KEY || !!process.env.JWT_PRIVATE_KEY_B64;
    const hasJwtPublic = !!process.env.JWT_PUBLIC_KEY || !!process.env.JWT_PUBLIC_KEY_B64;

    if (!hasJwtPrivate) missing.push('JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_B64');
    if (!hasJwtPublic) missing.push('JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_B64');
    if (!process.env.CSRF_SECRET) missing.push('CSRF_SECRET');

    const hasRefreshSecret = !!process.env.REFRESH_TOKEN_SECRET || hasJwtPrivate;
    if (!hasRefreshSecret) missing.push('REFRESH_TOKEN_SECRET');

    if (missing.length > 0) {
        throw new Error(`Missing required security environment variables: ${missing.join(', ')}`);
    }
};
