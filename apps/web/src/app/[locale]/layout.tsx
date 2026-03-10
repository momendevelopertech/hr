import '../globals.css';
import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Toaster } from 'react-hot-toast';
import { defaultLocale, locales } from '@/i18n/routing';
import { Noto_Kufi_Arabic, Sora } from 'next/font/google';

const notoKufiArabic = Noto_Kufi_Arabic({
    subsets: ['arabic'],
    variable: '--font-arabic-primary',
    weight: ['400', '500', '600', '700'],
});
const sora = Sora({
    subsets: ['latin'],
    variable: '--font-latin-primary',
    weight: ['400', '500', '600', '700'],
});

export const metadata = {
    title: 'SPHINX HR',
    description: 'Enterprise HR Management System',
    manifest: '/manifest.json',
    themeColor: '#1f3a52',
    icons: {
        icon: [
            { url: '/icons/icon.svg', type: 'image/svg+xml' },
            { url: '/brand/sphinx-head.svg', type: 'image/svg+xml' },
        ],
        apple: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
        shortcut: ['/icons/icon.svg'],
    },
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
    const fontClass = locale === 'ar' ? notoKufiArabic.variable : sora.variable;

    return (
        <html lang={locale} dir={dir} className={fontClass}>
            <body className={`bg-atmosphere text-ink ${locale === 'ar' ? 'font-ar' : 'font-base'}`}>
                <NextIntlClientProvider messages={messages}>
                    {children}
                    <Toaster position={locale === 'ar' ? 'top-left' : 'top-right'} />
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
