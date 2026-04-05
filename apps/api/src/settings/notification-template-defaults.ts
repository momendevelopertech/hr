export const NOTIFICATION_TEMPLATE_KEYS = [
    'accountCreated',
    'leaveReceipt',
    'permissionReceipt',
    'leaveSubmitted',
    'leaveVerified',
    'leaveManagerApproved',
    'leaveApproved',
    'leaveRejected',
    'permissionSubmitted',
    'permissionVerified',
    'permissionManagerApproved',
    'permissionApproved',
    'permissionRejected',
] as const;

export type NotificationTemplateKey = typeof NOTIFICATION_TEMPLATE_KEYS[number];

export type NotificationTemplateContent = {
    titleAr: string;
    titleEn: string;
    introAr: string;
    introEn: string;
    footerAr: string;
    footerEn: string;
};

export type NotificationTemplateMap = Record<NotificationTemplateKey, NotificationTemplateContent>;

const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplateMap = {
    accountCreated: {
        titleAr: 'تم إنشاء حسابك بنجاح',
        titleEn: 'Your account is ready',
        introAr: 'تم تجهيز حسابك على SPHINX HR ويمكنك تسجيل الدخول من الرابط التالي.',
        introEn: 'Your SPHINX HR account is ready and you can sign in from the link below.',
        footerAr: '{passwordHint}',
        footerEn: '{passwordHint}',
    },
    leaveReceipt: {
        titleAr: 'تم استلام {requestLabel}',
        titleEn: '{requestLabel} received',
        introAr: 'تم تسجيل طلبك بنجاح، والحالة الحالية هي: {status}.',
        introEn: 'Your request has been recorded successfully. Current status: {status}.',
        footerAr: 'راجع تفاصيل الطلب من الرابط التالي.',
        footerEn: 'Review the request details from the link below.',
    },
    permissionReceipt: {
        titleAr: 'تم استلام {requestLabel}',
        titleEn: '{requestLabel} received',
        introAr: 'تم تسجيل طلبك بنجاح، والحالة الحالية هي: {status}.',
        introEn: 'Your request has been recorded successfully. Current status: {status}.',
        footerAr: 'راجع تفاصيل الطلب من الرابط التالي.',
        footerEn: 'Review the request details from the link below.',
    },
    leaveSubmitted: {
        titleAr: 'تم تقديم طلب الإجازة',
        titleEn: 'Leave Request Submitted',
        introAr: 'تم إرسال {requestLabel} للمراجعة، والحالة الحالية: {status}.',
        introEn: 'Your {requestLabel} has been sent for review. Current status: {status}.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
    leaveVerified: {
        titleAr: 'تم التحقق من طلب الإجازة',
        titleEn: 'Leave Request Verified',
        introAr: 'تمت مراجعة {requestLabel} مبدئيًا وإرساله إلى المرحلة التالية.',
        introEn: 'Your {requestLabel} was verified and moved to the next approval stage.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
    leaveManagerApproved: {
        titleAr: 'موافقة المدير على طلب الإجازة',
        titleEn: 'Leave Approved by Manager',
        introAr: 'وافق المدير على {requestLabel} وتم تحويله إلى الموارد البشرية.',
        introEn: 'Your {requestLabel} was approved by the manager and forwarded to HR.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
    leaveApproved: {
        titleAr: 'تم اعتماد طلب الإجازة',
        titleEn: 'Leave Request Approved',
        introAr: 'تم اعتماد {requestLabel} بنجاح.',
        introEn: 'Your {requestLabel} has been approved successfully.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
    leaveRejected: {
        titleAr: 'تم رفض طلب الإجازة',
        titleEn: 'Leave Request Rejected',
        introAr: 'تم رفض {requestLabel}. يمكنك مراجعة التفاصيل أو التواصل مع المسؤول المباشر.',
        introEn: 'Your {requestLabel} was rejected. Please review the details or contact your manager.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
    permissionSubmitted: {
        titleAr: 'تم إرسال طلب الإذن',
        titleEn: 'Permission Request Submitted',
        introAr: 'تم إرسال {requestLabel} للمراجعة، والحالة الحالية: {status}.',
        introEn: 'Your {requestLabel} has been sent for review. Current status: {status}.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
    permissionVerified: {
        titleAr: 'تم التحقق من طلب الإذن',
        titleEn: 'Permission Request Verified',
        introAr: 'تمت مراجعة {requestLabel} مبدئيًا وإرساله إلى المرحلة التالية.',
        introEn: 'Your {requestLabel} was verified and moved to the next approval stage.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
    permissionManagerApproved: {
        titleAr: 'موافقة المدير على طلب الإذن',
        titleEn: 'Permission Approved by Manager',
        introAr: 'وافق المدير على {requestLabel} وتم تحويله إلى الموارد البشرية.',
        introEn: 'Your {requestLabel} was approved by the manager and forwarded to HR.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
    permissionApproved: {
        titleAr: 'تم اعتماد طلب الإذن',
        titleEn: 'Permission Approved',
        introAr: 'تم اعتماد {requestLabel} بنجاح.',
        introEn: 'Your {requestLabel} has been approved successfully.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
    permissionRejected: {
        titleAr: 'تم رفض طلب الإذن',
        titleEn: 'Permission Rejected',
        introAr: 'تم رفض {requestLabel}. يمكنك مراجعة التفاصيل أو التواصل مع المسؤول المباشر.',
        introEn: 'Your {requestLabel} was rejected. Please review the details or contact your manager.',
        footerAr: '{commentHint}',
        footerEn: '{commentHint}',
    },
};

const TEMPLATE_FIELDS: Array<keyof NotificationTemplateContent> = [
    'titleAr',
    'titleEn',
    'introAr',
    'introEn',
    'footerAr',
    'footerEn',
];

const hasArabicCharacters = (value: string) => /[\u0600-\u06FF]/.test(value);

const isBrokenArabicTemplateText = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed.includes('�')) return true;
    if (!hasArabicCharacters(trimmed) && /(\?{2,}|Ø|Ù|â|ðŸ)/.test(trimmed)) {
        return true;
    }
    return false;
};

export const getDefaultNotificationTemplates = (): NotificationTemplateMap => {
    return NOTIFICATION_TEMPLATE_KEYS.reduce((acc, key) => {
        acc[key] = { ...DEFAULT_NOTIFICATION_TEMPLATES[key] };
        return acc;
    }, {} as NotificationTemplateMap);
};

export const normalizeNotificationTemplates = (input: unknown): NotificationTemplateMap => {
    const defaults = getDefaultNotificationTemplates();
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return defaults;
    }

    const record = input as Record<string, unknown>;
    NOTIFICATION_TEMPLATE_KEYS.forEach((key) => {
        const candidate = record[key];
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
            return;
        }

        TEMPLATE_FIELDS.forEach((field) => {
            const value = (candidate as Record<string, unknown>)[field];
            if (typeof value === 'string') {
                if (field.endsWith('Ar') && isBrokenArabicTemplateText(value)) {
                    return;
                }
                defaults[key][field] = value;
            }
        });
    });

    return defaults;
};
