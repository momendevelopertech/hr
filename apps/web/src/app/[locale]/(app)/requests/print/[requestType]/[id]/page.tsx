import type { Metadata } from 'next';
import RequestPrintPreview from '@/components/RequestPrintPreview';

type RequestType = 'leave' | 'permission';

const OG_IMAGE_PNG_URL = 'https://hr-web-ten.vercel.app/brand/sphinx-logo.png';
const OG_IMAGE_SVG_URL = 'https://hr-web-ten.vercel.app/brand/sphinx-logo.svg';

function buildMetadata(locale: string, requestType: RequestType): Metadata {
    const isArabic = locale === 'ar';
    const isLeave = requestType === 'leave';

    const title = isArabic
        ? isLeave
            ? 'SPHINX HR - طلب إجازة'
            : 'SPHINX HR - طلب إذن'
        : isLeave
            ? 'SPHINX HR - Leave Request'
            : 'SPHINX HR - Permission Request';

    const description = isArabic
        ? isLeave
            ? 'تم استلام طلب إجازة اعتيادية للمستخدم، والحالة: تم الاعتماد تلقائيًا'
            : 'تم استلام طلب إذن للمستخدم، والحالة: تم الاعتماد تلقائيًا'
        : isLeave
            ? 'A leave request was received for the user and auto-approved.'
            : 'A permission request was received for the user and auto-approved.';

    const twitterDescription = isArabic
        ? isLeave
            ? 'تم استلام طلب إجازة اعتيادية'
            : 'تم استلام طلب إذن'
        : isLeave
            ? 'A leave request was received'
            : 'A permission request was received';

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            locale: isArabic ? 'ar_AR' : 'en_US',
            images: [
                {
                    url: OG_IMAGE_PNG_URL,
                    width: 1200,
                    height: 630,
                },
                {
                    url: OG_IMAGE_SVG_URL,
                    width: 1200,
                    height: 630,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: twitterDescription,
            images: [OG_IMAGE_PNG_URL],
        },
    };
}

export function generateMetadata({
    params,
}: {
    params: { locale: string; requestType: RequestType; id: string };
}): Metadata {
    return buildMetadata(params.locale, params.requestType);
}

export default function RequestPrintPage({
    params,
}: {
    params: { locale: string; requestType: RequestType; id: string };
}) {
    return (
        <RequestPrintPreview
            locale={params.locale}
            requestType={params.requestType}
            id={params.id}
        />
    );
}
