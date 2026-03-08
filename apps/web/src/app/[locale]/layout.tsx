import '../globals.css';
import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { defaultLocale, locales } from '@/i18n/routing';
import { Cairo, Manrope } from 'next/font/google';

const cairo = Cairo({ subsets: ['arabic'], variable: '--font-cairo', weight: ['400', '600', '700'] });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['400', '600', '700'] });

export const metadata = {
    title: 'SPHINX HR',
    description: 'Enterprise HR Management System',
    manifest: '/manifest.json',
    themeColor: '#1f3a52',
};

export default async function LocaleLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: { locale: string };
}) {
    const locale = locales.includes(params.locale as any) ? params.locale : defaultLocale;
    if (!locale) notFound();
    const messages = await getMessages();
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    const fontClass = locale === 'ar' ? cairo.variable : manrope.variable;

    return (
        <html lang={locale} dir={dir} className={fontClass}>
            <body className={`bg-atmosphere text-ink ${locale === 'ar' ? 'font-ar' : 'font-base'}`}>
                <NextIntlClientProvider messages={messages}>
                    {children}
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
