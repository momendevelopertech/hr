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

export type TemplateLocale = 'ar' | 'en';

export type TemplatePlaceholder = {
    token: string;
    labelAr: string;
    labelEn: string;
};

export type TemplatePreviewDetail = {
    icon: string;
    labelAr: string;
    labelEn: string;
    valueAr: string;
    valueEn: string;
};

export type NotificationTemplateDefinition = {
    key: NotificationTemplateKey;
    category: 'account' | 'leave' | 'permission';
    icon: 'sparkles' | 'calendar' | 'clock';
    labelAr: string;
    labelEn: string;
    descriptionAr: string;
    descriptionEn: string;
    placeholders: TemplatePlaceholder[];
    previewValues: Record<TemplateLocale, Record<string, string>>;
    previewDetails: TemplatePreviewDetail[];
    previewLink: string;
};

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplateMap = {
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

const accountPlaceholders: TemplatePlaceholder[] = [
    { token: '{employeeName}', labelAr: 'اسم الموظف', labelEn: 'Employee name' },
    { token: '{employeeNumber}', labelAr: 'رقم الموظف', labelEn: 'Employee number' },
    { token: '{username}', labelAr: 'اسم المستخدم', labelEn: 'Username' },
    { token: '{workflowMode}', labelAr: 'وضع الطلبات', labelEn: 'Workflow mode' },
    { token: '{temporaryPassword}', labelAr: 'كلمة المرور المؤقتة', labelEn: 'Temporary password' },
    { token: '{passwordHint}', labelAr: 'تنويه كلمة المرور', labelEn: 'Password hint' },
];

const requestPlaceholders: TemplatePlaceholder[] = [
    { token: '{employeeName}', labelAr: 'اسم الموظف', labelEn: 'Employee name' },
    { token: '{requestLabel}', labelAr: 'اسم الطلب', labelEn: 'Request label' },
    { token: '{status}', labelAr: 'الحالة', labelEn: 'Status' },
    { token: '{requestDate}', labelAr: 'تاريخ الطلب', labelEn: 'Request date' },
    { token: '{startDate}', labelAr: 'من تاريخ', labelEn: 'Start date' },
    { token: '{endDate}', labelAr: 'إلى تاريخ', labelEn: 'End date' },
    { token: '{duration}', labelAr: 'المدة', labelEn: 'Duration' },
    { token: '{reason}', labelAr: 'السبب', labelEn: 'Reason' },
    { token: '{commentHint}', labelAr: 'ملاحظة من المسؤول', labelEn: 'Manager note' },
];

const permissionPlaceholders: TemplatePlaceholder[] = [
    { token: '{employeeName}', labelAr: 'اسم الموظف', labelEn: 'Employee name' },
    { token: '{requestLabel}', labelAr: 'اسم الطلب', labelEn: 'Request label' },
    { token: '{status}', labelAr: 'الحالة', labelEn: 'Status' },
    { token: '{requestDate}', labelAr: 'تاريخ الطلب', labelEn: 'Request date' },
    { token: '{timeRange}', labelAr: 'نطاق الوقت', labelEn: 'Time range' },
    { token: '{duration}', labelAr: 'المدة', labelEn: 'Duration' },
    { token: '{reason}', labelAr: 'السبب', labelEn: 'Reason' },
    { token: '{commentHint}', labelAr: 'ملاحظة من المسؤول', labelEn: 'Manager note' },
];

const accountPreviewValues = {
    ar: {
        employeeName: 'أحمد علي',
        employeeNumber: 'EMP-1024',
        username: 'ahmed1024',
        workflowMode: 'سير الموافقات',
        temporaryPassword: 'SPHINX@2026',
        passwordHint: 'يرجى تغيير كلمة المرور بعد أول تسجيل دخول.',
    },
    en: {
        employeeName: 'Ahmed Ali',
        employeeNumber: 'EMP-1024',
        username: 'ahmed1024',
        workflowMode: 'Approval Workflow',
        temporaryPassword: 'SPHINX@2026',
        passwordHint: 'Please change your password after your first login.',
    },
};

const leaveReceiptPreviewValues = {
    ar: {
        employeeName: 'أحمد علي',
        requestLabel: 'طلب غياب بإذن',
        status: 'تم تسجيل الطلب وهو قيد المراجعة',
        requestDate: '١ أبريل ٢٠٢٦',
        startDate: '١ أبريل ٢٠٢٦',
        endDate: '١ أبريل ٢٠٢٦',
        duration: 'يوم واحد',
        reason: 'ظرف عائلي',
        commentHint: '',
    },
    en: {
        employeeName: 'Ahmed Ali',
        requestLabel: 'Absence with permission request',
        status: 'Submitted and pending review',
        requestDate: '1 Apr 2026',
        startDate: '1 Apr 2026',
        endDate: '1 Apr 2026',
        duration: '1 day',
        reason: 'Family matter',
        commentHint: '',
    },
};

const permissionReceiptPreviewValues = {
    ar: {
        employeeName: 'منى سمير',
        requestLabel: 'طلب إذن انصراف مبكر',
        status: 'تم تسجيل الطلب وهو قيد المراجعة',
        requestDate: '٢ أبريل ٢٠٢٦',
        timeRange: '09:00 - 15:00',
        duration: '٢ ساعة',
        reason: 'مراجعة شخصية',
        commentHint: '',
    },
    en: {
        employeeName: 'Mona Samir',
        requestLabel: 'Early leave permission request',
        status: 'Submitted and pending review',
        requestDate: '2 Apr 2026',
        timeRange: '09:00 - 15:00',
        duration: '2 hours',
        reason: 'Personal errand',
        commentHint: '',
    },
};

const leaveActionPreviewValues = {
    submitted: {
        ar: { ...leaveReceiptPreviewValues.ar },
        en: { ...leaveReceiptPreviewValues.en },
    },
    verified: {
        ar: { ...leaveReceiptPreviewValues.ar, status: 'تمت المراجعة المبدئية' },
        en: { ...leaveReceiptPreviewValues.en, status: 'Verified' },
    },
    managerApproved: {
        ar: { ...leaveReceiptPreviewValues.ar, status: 'موافقة المدير' },
        en: { ...leaveReceiptPreviewValues.en, status: 'Manager approved' },
    },
    approved: {
        ar: { ...leaveReceiptPreviewValues.ar, status: 'تم الاعتماد', commentHint: 'ملاحظة: تمت الموافقة النهائية على الطلب.' },
        en: { ...leaveReceiptPreviewValues.en, status: 'Approved', commentHint: 'Comment: Final approval completed.' },
    },
    rejected: {
        ar: { ...leaveReceiptPreviewValues.ar, status: 'مرفوض', commentHint: 'ملاحظة: يرجى مراجعة المدير لإعادة التقديم.' },
        en: { ...leaveReceiptPreviewValues.en, status: 'Rejected', commentHint: 'Comment: Please contact your manager before resubmitting.' },
    },
};

const permissionActionPreviewValues = {
    submitted: {
        ar: { ...permissionReceiptPreviewValues.ar },
        en: { ...permissionReceiptPreviewValues.en },
    },
    verified: {
        ar: { ...permissionReceiptPreviewValues.ar, status: 'تمت المراجعة المبدئية' },
        en: { ...permissionReceiptPreviewValues.en, status: 'Verified' },
    },
    managerApproved: {
        ar: { ...permissionReceiptPreviewValues.ar, status: 'موافقة المدير' },
        en: { ...permissionReceiptPreviewValues.en, status: 'Manager approved' },
    },
    approved: {
        ar: { ...permissionReceiptPreviewValues.ar, status: 'تم الاعتماد', commentHint: 'ملاحظة: تمت الموافقة من المدير.' },
        en: { ...permissionReceiptPreviewValues.en, status: 'Approved', commentHint: 'Comment: Approved by your manager.' },
    },
    rejected: {
        ar: { ...permissionReceiptPreviewValues.ar, status: 'مرفوض', commentHint: 'ملاحظة: أضف سببًا أو عدّل الوقت المطلوب.' },
        en: { ...permissionReceiptPreviewValues.en, status: 'Rejected', commentHint: 'Comment: Add a reason or adjust the requested time.' },
    },
};

const accountPreviewDetails: TemplatePreviewDetail[] = [
    { icon: '🆔', labelAr: 'رقم الموظف', labelEn: 'Employee #', valueAr: 'EMP-1024', valueEn: 'EMP-1024' },
    { icon: '👤', labelAr: 'اسم المستخدم', labelEn: 'Username', valueAr: 'ahmed1024', valueEn: 'ahmed1024' },
    { icon: '🔐', labelAr: 'كلمة المرور المؤقتة', labelEn: 'Temporary password', valueAr: 'SPHINX@2026', valueEn: 'SPHINX@2026' },
    { icon: '📌', labelAr: 'وضع الطلبات', labelEn: 'Request mode', valueAr: 'سير الموافقات', valueEn: 'Approval Workflow' },
];

const leavePreviewDetails: TemplatePreviewDetail[] = [
    { icon: '🗂️', labelAr: 'نوع الطلب', labelEn: 'Request type', valueAr: 'غياب بإذن', valueEn: 'Absence with permission' },
    { icon: '📅', labelAr: 'التاريخ', labelEn: 'Date', valueAr: '١ أبريل ٢٠٢٦', valueEn: '1 Apr 2026' },
    { icon: '⏳', labelAr: 'المدة', labelEn: 'Duration', valueAr: 'يوم واحد', valueEn: '1 day' },
    { icon: '📝', labelAr: 'التفاصيل', labelEn: 'Details', valueAr: 'ظرف عائلي', valueEn: 'Family matter' },
];

const permissionPreviewDetails: TemplatePreviewDetail[] = [
    { icon: '🗂️', labelAr: 'نوع الطلب', labelEn: 'Request type', valueAr: 'إذن انصراف مبكر', valueEn: 'Early leave permission' },
    { icon: '📅', labelAr: 'التاريخ', labelEn: 'Date', valueAr: '٢ أبريل ٢٠٢٦', valueEn: '2 Apr 2026' },
    { icon: '⏰', labelAr: 'الوقت', labelEn: 'Time', valueAr: '09:00 - 15:00', valueEn: '09:00 - 15:00' },
    { icon: '⏳', labelAr: 'المدة', labelEn: 'Duration', valueAr: '٢ ساعة', valueEn: '2 hours' },
    { icon: '📝', labelAr: 'التفاصيل', labelEn: 'Details', valueAr: 'مراجعة شخصية', valueEn: 'Personal errand' },
];

export const NOTIFICATION_TEMPLATE_DEFINITIONS: NotificationTemplateDefinition[] = [
    {
        key: 'accountCreated',
        category: 'account',
        icon: 'sparkles',
        labelAr: 'إنشاء الحساب',
        labelEn: 'Account Created',
        descriptionAr: 'الرسالة الأولى التي تصل للموظف بعد إنشاء الحساب.',
        descriptionEn: 'The first message sent right after account creation.',
        placeholders: accountPlaceholders,
        previewValues: accountPreviewValues,
        previewDetails: accountPreviewDetails,
        previewLink: 'https://hr.example.com/ar',
    },
    {
        key: 'leaveReceipt',
        category: 'leave',
        icon: 'calendar',
        labelAr: 'استلام طلب إجازة',
        labelEn: 'Leave Receipt',
        descriptionAr: 'تأكيد استلام طلب الإجازة أو الغياب بإذن.',
        descriptionEn: 'Confirms that a leave request was received.',
        placeholders: requestPlaceholders,
        previewValues: leaveReceiptPreviewValues,
        previewDetails: leavePreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/leave/req-1001',
    },
    {
        key: 'permissionReceipt',
        category: 'permission',
        icon: 'clock',
        labelAr: 'استلام طلب إذن',
        labelEn: 'Permission Receipt',
        descriptionAr: 'تأكيد استلام طلب الإذن وتفاصيله.',
        descriptionEn: 'Confirms that a permission request was received.',
        placeholders: permissionPlaceholders,
        previewValues: permissionReceiptPreviewValues,
        previewDetails: permissionPreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/permission/req-2001',
    },
    {
        key: 'leaveSubmitted',
        category: 'leave',
        icon: 'calendar',
        labelAr: 'إجازة: تم الإرسال',
        labelEn: 'Leave: Submitted',
        descriptionAr: 'بعد إنشاء الطلب وإرساله لأول مرحلة مراجعة.',
        descriptionEn: 'After the leave request is submitted for the first review stage.',
        placeholders: requestPlaceholders,
        previewValues: leaveActionPreviewValues.submitted,
        previewDetails: leavePreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/leave/req-1001',
    },
    {
        key: 'leaveVerified',
        category: 'leave',
        icon: 'calendar',
        labelAr: 'إجازة: تم التحقق',
        labelEn: 'Leave: Verified',
        descriptionAr: 'عند انتهاء المراجعة الأولية للطلب.',
        descriptionEn: 'When the initial leave review is completed.',
        placeholders: requestPlaceholders,
        previewValues: leaveActionPreviewValues.verified,
        previewDetails: leavePreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/leave/req-1001',
    },
    {
        key: 'leaveManagerApproved',
        category: 'leave',
        icon: 'calendar',
        labelAr: 'إجازة: موافقة المدير',
        labelEn: 'Leave: Manager Approved',
        descriptionAr: 'عند اعتماد المدير للطلب.',
        descriptionEn: 'When the manager approves the leave request.',
        placeholders: requestPlaceholders,
        previewValues: leaveActionPreviewValues.managerApproved,
        previewDetails: leavePreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/leave/req-1001',
    },
    {
        key: 'leaveApproved',
        category: 'leave',
        icon: 'calendar',
        labelAr: 'إجازة: تم الاعتماد',
        labelEn: 'Leave: Approved',
        descriptionAr: 'الرسالة النهائية بعد اعتماد الطلب.',
        descriptionEn: 'The final message after the leave request is approved.',
        placeholders: requestPlaceholders,
        previewValues: leaveActionPreviewValues.approved,
        previewDetails: leavePreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/leave/req-1001',
    },
    {
        key: 'leaveRejected',
        category: 'leave',
        icon: 'calendar',
        labelAr: 'إجازة: تم الرفض',
        labelEn: 'Leave: Rejected',
        descriptionAr: 'عند رفض الطلب مع إمكانية إظهار ملاحظة.',
        descriptionEn: 'When the leave request is rejected, with an optional note.',
        placeholders: requestPlaceholders,
        previewValues: leaveActionPreviewValues.rejected,
        previewDetails: leavePreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/leave/req-1001',
    },
    {
        key: 'permissionSubmitted',
        category: 'permission',
        icon: 'clock',
        labelAr: 'إذن: تم الإرسال',
        labelEn: 'Permission: Submitted',
        descriptionAr: 'بعد إنشاء طلب الإذن وإرساله للمراجعة.',
        descriptionEn: 'After a permission request is submitted for review.',
        placeholders: permissionPlaceholders,
        previewValues: permissionActionPreviewValues.submitted,
        previewDetails: permissionPreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/permission/req-2001',
    },
    {
        key: 'permissionVerified',
        category: 'permission',
        icon: 'clock',
        labelAr: 'إذن: تم التحقق',
        labelEn: 'Permission: Verified',
        descriptionAr: 'عند انتهاء المراجعة الأولية لطلب الإذن.',
        descriptionEn: 'When the initial permission review is completed.',
        placeholders: permissionPlaceholders,
        previewValues: permissionActionPreviewValues.verified,
        previewDetails: permissionPreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/permission/req-2001',
    },
    {
        key: 'permissionManagerApproved',
        category: 'permission',
        icon: 'clock',
        labelAr: 'إذن: موافقة المدير',
        labelEn: 'Permission: Manager Approved',
        descriptionAr: 'عند اعتماد المدير لطلب الإذن.',
        descriptionEn: 'When the manager approves the permission request.',
        placeholders: permissionPlaceholders,
        previewValues: permissionActionPreviewValues.managerApproved,
        previewDetails: permissionPreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/permission/req-2001',
    },
    {
        key: 'permissionApproved',
        category: 'permission',
        icon: 'clock',
        labelAr: 'إذن: تم الاعتماد',
        labelEn: 'Permission: Approved',
        descriptionAr: 'الرسالة النهائية بعد اعتماد طلب الإذن.',
        descriptionEn: 'The final message after the permission request is approved.',
        placeholders: permissionPlaceholders,
        previewValues: permissionActionPreviewValues.approved,
        previewDetails: permissionPreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/permission/req-2001',
    },
    {
        key: 'permissionRejected',
        category: 'permission',
        icon: 'clock',
        labelAr: 'إذن: تم الرفض',
        labelEn: 'Permission: Rejected',
        descriptionAr: 'عند رفض طلب الإذن مع إمكانية إظهار ملاحظة.',
        descriptionEn: 'When the permission request is rejected, with an optional note.',
        placeholders: permissionPlaceholders,
        previewValues: permissionActionPreviewValues.rejected,
        previewDetails: permissionPreviewDetails,
        previewLink: 'https://hr.example.com/ar/requests/print/permission/req-2001',
    },
];

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

        (Object.keys(defaults[key]) as Array<keyof NotificationTemplateContent>).forEach((field) => {
            const value = (candidate as Record<string, unknown>)[field];
            if (typeof value !== 'string') return;
            if (field.endsWith('Ar') && isBrokenArabicTemplateText(value)) {
                return;
            }
            defaults[key][field] = value;
        });
    });

    return defaults;
};
