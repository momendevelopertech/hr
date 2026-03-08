import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales } from './routing';

export default getRequestConfig(async ({ locale }) => {
    const resolvedLocale = locales.includes(locale as any) ? locale : defaultLocale;
    return {
        locale: resolvedLocale,
        messages: (await import(`../messages/${resolvedLocale}.json`)).default,
    };
});
