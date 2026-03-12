import RequestPrintPreview from '@/components/RequestPrintPreview';

export default function RequestPrintPage({
    params,
}: {
    params: { locale: string; requestType: 'leave' | 'permission'; id: string };
}) {
    return (
        <RequestPrintPreview
            locale={params.locale}
            requestType={params.requestType}
            id={params.id}
        />
    );
}
