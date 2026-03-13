import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales } from './i18n/routing';

const intlMiddleware = createMiddleware({
    locales,
    defaultLocale,
    localePrefix: 'always',
});

const publicPaths = new Set(['login', 'forgot-password', 'reset-password', 'unauthorized']);

export default function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const segments = pathname.split('/').filter(Boolean);
    const locale = segments[0];
    const route = segments[1] || '';

    if (locale && locales.includes(locale as any) && !publicPaths.has(route)) {
        const hasAccessToken = !!req.cookies.get('access_token')?.value;
        const hasRefreshToken = !!req.cookies.get('refresh_token')?.value;

        if (!hasAccessToken && !hasRefreshToken) {
            return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
        }
    }

    return intlMiddleware(req);
}

export const config = {
    matcher: ['/((?!api|_next|.*\\..*).*)'],
};
