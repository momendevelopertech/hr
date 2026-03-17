/** @type {import('next').NextConfig} */
const defaultRuntimeCaching = require('next-pwa/cache');

const runtimeCaching = [
    // Block caching for dynamic API traffic (always network).
    {
        urlPattern: /^\/api\/.*/i,
        handler: 'NetworkOnly',
        options: {
            cacheName: 'api-runtime-local',
        },
    },
    {
        urlPattern: /^https?:\/\/[^/]+\/api\/.*/i,
        handler: 'NetworkOnly',
        options: {
            cacheName: 'api-runtime-remote',
        },
    },
    // Keep default runtime caching for static assets/fonts/images, but drop any generic api rule if present.
    ...defaultRuntimeCaching.filter(
        (rule) => !(rule.urlPattern && /api/i.test(rule.urlPattern.toString())),
    ),
];

const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    clientsClaim: true,
    disable: process.env.NODE_ENV === 'development',
    buildExcludes: [/app-build-manifest\.json$/],
    runtimeCaching,
});

const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');


const hasScheme = (value) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
const isLocalHost = (value) => /^(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(value);

const normalizeApiHost = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed || trimmed.startsWith('/')) return '';

    const withoutProtocolRelative = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
    const withScheme = hasScheme(withoutProtocolRelative)
        ? withoutProtocolRelative
        : isLocalHost(withoutProtocolRelative)
            ? `http://${withoutProtocolRelative}`
            : `https://${withoutProtocolRelative}`;

    return withScheme.replace(/\/$/, '').replace(/\/api$/, '');
};

const nextConfig = {
    reactStrictMode: true,
    images: {
        domains: ['res.cloudinary.com', 'lh3.googleusercontent.com'],
    },
    async rewrites() {
        const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '';
        const normalizedApiUrl = normalizeApiHost(rawApiUrl);

        if (!normalizedApiUrl) {
            return [];
        }

        return [
            {
                source: '/api/:path*',
                destination: `${normalizedApiUrl}/api/:path*`,
            },
        ];
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                ],
            },
        ];
    },
};

module.exports = withNextIntl(withPWA(nextConfig));
