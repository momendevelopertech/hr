'use client';

import { useState } from 'react';
import { CalendarRange, Clock3, Copy, Mail, MessageSquareText, RotateCcw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getDefaultNotificationTemplates,
    NOTIFICATION_TEMPLATE_DEFINITIONS,
    NOTIFICATION_TEMPLATE_KEYS,
    NotificationTemplateKey,
    NotificationTemplateMap,
    TemplateLocale,
} from '@/lib/notification-template-catalog';

const iconMap = {
    sparkles: Sparkles,
    calendar: CalendarRange,
    clock: Clock3,
};

const interpolateTemplate = (template: string, values: Record<string, string>) => {
    return template
        .replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => values[key] ?? '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const localeFieldMap: Record<TemplateLocale, { title: 'titleAr' | 'titleEn'; intro: 'introAr' | 'introEn'; footer: 'footerAr' | 'footerEn' }> = {
    ar: { title: 'titleAr', intro: 'introAr', footer: 'footerAr' },
    en: { title: 'titleEn', intro: 'introEn', footer: 'footerEn' },
};

export default function NotificationTemplatesManager({
    locale,
    value,
    onChange,
}: {
    locale: string;
    value: NotificationTemplateMap;
    onChange: (next: NotificationTemplateMap) => void;
}) {
    const initialLocale: TemplateLocale = locale === 'en' ? 'en' : 'ar';
    const [activeTemplateKey, setActiveTemplateKey] = useState<NotificationTemplateKey>(NOTIFICATION_TEMPLATE_KEYS[0]);
    const [editorLocale, setEditorLocale] = useState<TemplateLocale>(initialLocale);
    const labels = initialLocale === 'ar'
        ? {
            eyebrow: 'تجربة الرسائل',
            title: 'تيمبلتات الإشعارات',
            description: 'يمكن لمسؤول الموارد البشرية والإدمن تعديل رسائل إنشاء الحساب وتأكيدات الطلبات ومراحل الموافقات مع معاينة فورية قبل الحفظ.',
            count: `${NOTIFICATION_TEMPLATE_DEFINITIONS.length} تيمبلت`,
            editableBy: 'قابل للتعديل لمسؤول الموارد البشرية / السوبر أدمن',
            groupAccount: 'الحساب',
            groupLeave: 'رحلة الإجازات',
            groupPermission: 'رحلة الأذونات',
            fieldTitle: 'العنوان',
            fieldIntro: 'النص الرئيسي',
            fieldFooter: 'الخاتمة أو الملاحظة الأخيرة',
            placeholdersTitle: 'المتغيرات الديناميكية',
            placeholdersHint: 'انسخ أي متغير وضعه داخل التيمبلت ليتم جلب بيانات الموظف أو الطلب تلقائيًا.',
            placeholderCount: 'متغير',
            resetAll: 'استعادة كل التيمبلتات',
            resetAllDone: 'تمت إعادة كل التيمبلتات إلى الصيغة الافتراضية.',
            resetSelected: 'تمت إعادة التيمبلت الحالي إلى الصيغة الافتراضية.',
            resetSelectedAction: 'استعادة الحالي',
            tokenCopied: 'تم نسخ',
            tokenCopyFailed: 'تعذر نسخ المتغير.',
            requestLink: 'رابط الطلب',
            live: 'مباشر',
        }
        : {
            eyebrow: 'Message Experience',
            title: 'Notification Templates',
            description: 'Let HR and admins refine account-creation, request-receipt, and approval-stage messages with live previews before saving.',
            count: `${NOTIFICATION_TEMPLATE_DEFINITIONS.length} templates`,
            editableBy: 'Editable by HR Admin / Super Admin',
            groupAccount: 'Account',
            groupLeave: 'Leave Flow',
            groupPermission: 'Permission Flow',
            fieldTitle: 'Headline',
            fieldIntro: 'Main text',
            fieldFooter: 'Footer or closing note',
            placeholdersTitle: 'Dynamic placeholders',
            placeholdersHint: 'Copy any placeholder and paste it inside the template to inject live employee or request data automatically.',
            placeholderCount: 'tokens',
            resetAll: 'Reset all templates',
            resetAllDone: 'All templates returned to their default wording.',
            resetSelected: 'Template restored to default wording.',
            resetSelectedAction: 'Reset selected',
            tokenCopied: 'Copied',
            tokenCopyFailed: 'Unable to copy the placeholder.',
            requestLink: 'Request link',
            live: 'Live',
        };

    const activeDefinition = NOTIFICATION_TEMPLATE_DEFINITIONS.find((item) => item.key === activeTemplateKey) || NOTIFICATION_TEMPLATE_DEFINITIONS[0];
    const activeTemplate = value[activeTemplateKey];
    const localeFields = localeFieldMap[editorLocale];
    const previewValues = activeDefinition.previewValues[editorLocale];
    const previewTitle = interpolateTemplate(activeTemplate[localeFields.title], previewValues);
    const previewIntro = interpolateTemplate(activeTemplate[localeFields.intro], previewValues);
    const previewFooter = interpolateTemplate(activeTemplate[localeFields.footer], previewValues);
    const previewLink = editorLocale === 'en'
        ? activeDefinition.previewLink.replace('/ar/', '/en/').replace(/\/ar$/, '/en')
        : activeDefinition.previewLink;

    const groupedDefinitions = [
        {
            key: 'account',
            label: labels.groupAccount,
            items: NOTIFICATION_TEMPLATE_DEFINITIONS.filter((item) => item.category === 'account'),
        },
        {
            key: 'leave',
            label: labels.groupLeave,
            items: NOTIFICATION_TEMPLATE_DEFINITIONS.filter((item) => item.category === 'leave'),
        },
        {
            key: 'permission',
            label: labels.groupPermission,
            items: NOTIFICATION_TEMPLATE_DEFINITIONS.filter((item) => item.category === 'permission'),
        },
    ];

    const updateField = (field: 'titleAr' | 'titleEn' | 'introAr' | 'introEn' | 'footerAr' | 'footerEn', nextValue: string) => {
        onChange({
            ...value,
            [activeTemplateKey]: {
                ...activeTemplate,
                [field]: nextValue,
            },
        });
    };

    const resetSelected = () => {
        const defaults = getDefaultNotificationTemplates();
        onChange({
            ...value,
            [activeTemplateKey]: defaults[activeTemplateKey],
        });
        toast.success(labels.resetSelected);
    };

    const resetAll = () => {
        onChange(getDefaultNotificationTemplates());
        toast.success(labels.resetAllDone);
    };

    const copyPlaceholder = async (token: string) => {
        try {
            await navigator.clipboard.writeText(token);
            toast.success(`${labels.tokenCopied} ${token}`);
        } catch {
            toast.error(labels.tokenCopyFailed);
        }
    };

    return (
        <section className="card overflow-hidden">
            <div className="template-hero p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.26em] text-ink/45">{labels.eyebrow}</p>
                        <div>
                            <h2 className="text-xl font-semibold text-ink">{labels.title}</h2>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-ink/65">{labels.description}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-ink/10 bg-white/80 px-3 py-1 text-xs font-medium text-ink/65">
                            {labels.count}
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            {labels.editableBy}
                        </span>
                        <button className="btn-outline" type="button" onClick={resetAll}>
                            {labels.resetAll}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid xl:grid-cols-[290px_minmax(0,1fr)]">
                <aside className="border-b border-ink/10 bg-white/70 p-4 xl:border-b-0 xl:border-e">
                    <div className="space-y-4">
                        {groupedDefinitions.map((group) => (
                            <div key={group.key} className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">{group.label}</p>
                                <div className="space-y-2">
                                    {group.items.map((item) => {
                                        const Icon = iconMap[item.icon];
                                        const active = item.key === activeTemplateKey;
                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => setActiveTemplateKey(item.key)}
                                                className={`w-full rounded-2xl border px-3 py-3 text-start transition ${active
                                                    ? 'border-emerald-300 bg-emerald-50/90 shadow-sm'
                                                    : 'border-ink/10 bg-white/85 hover:border-emerald-200 hover:bg-emerald-50/40'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`rounded-2xl p-2 ${active ? 'bg-emerald-500/12 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-ink">
                                                            {editorLocale === 'ar' ? item.labelAr : item.labelEn}
                                                        </p>
                                                        <p className="mt-1 text-xs leading-5 text-ink/55">
                                                            {editorLocale === 'ar' ? item.descriptionAr : item.descriptionEn}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                <div className="grid gap-6 p-5 2xl:grid-cols-[minmax(0,1.15fr)_370px]">
                    <div className="space-y-5">
                        <div className="flex flex-col gap-3 rounded-3xl border border-ink/10 bg-slate-50/70 p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-ink">
                                    {editorLocale === 'ar' ? activeDefinition.labelAr : activeDefinition.labelEn}
                                </p>
                                <p className="mt-1 text-sm text-ink/60">
                                    {editorLocale === 'ar' ? activeDefinition.descriptionAr : activeDefinition.descriptionEn}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="inline-flex rounded-full border border-ink/10 bg-white p-1">
                                    <button
                                        type="button"
                                        onClick={() => setEditorLocale('ar')}
                                        className={`rounded-full px-3 py-1.5 text-sm ${editorLocale === 'ar' ? 'bg-emerald-600 text-white' : 'text-ink/65'}`}
                                    >
                                        العربية
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditorLocale('en')}
                                        className={`rounded-full px-3 py-1.5 text-sm ${editorLocale === 'en' ? 'bg-emerald-600 text-white' : 'text-ink/65'}`}
                                    >
                                        English
                                    </button>
                                </div>
                                <button className="btn-outline" type="button" onClick={resetSelected}>
                                    <RotateCcw className="h-4 w-4" />
                                    <span>{labels.resetSelectedAction}</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <label className="space-y-2 text-sm font-medium text-ink">
                                <span>{labels.fieldTitle}</span>
                                <input
                                    dir={editorLocale === 'ar' ? 'rtl' : 'ltr'}
                                    className={`w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}
                                    value={activeTemplate[localeFields.title]}
                                    onChange={(e) => updateField(localeFields.title, e.target.value)}
                                />
                            </label>

                            <label className="space-y-2 text-sm font-medium text-ink">
                                <span>{labels.fieldIntro}</span>
                                <textarea
                                    dir={editorLocale === 'ar' ? 'rtl' : 'ltr'}
                                    className={`min-h-[140px] w-full rounded-3xl border border-ink/15 bg-white px-4 py-3 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}
                                    value={activeTemplate[localeFields.intro]}
                                    onChange={(e) => updateField(localeFields.intro, e.target.value)}
                                />
                            </label>

                            <label className="space-y-2 text-sm font-medium text-ink">
                                <span>{labels.fieldFooter}</span>
                                <textarea
                                    dir={editorLocale === 'ar' ? 'rtl' : 'ltr'}
                                    className={`min-h-[96px] w-full rounded-3xl border border-ink/15 bg-white px-4 py-3 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}
                                    value={activeTemplate[localeFields.footer]}
                                    onChange={(e) => updateField(localeFields.footer, e.target.value)}
                                />
                            </label>
                        </div>

                        <div className="rounded-3xl border border-dashed border-ink/15 bg-white/80 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-ink">{labels.placeholdersTitle}</p>
                                    <p className="mt-1 text-sm text-ink/55">{labels.placeholdersHint}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                    {activeDefinition.placeholders.length} {labels.placeholderCount}
                                </span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {activeDefinition.placeholders.map((placeholder) => (
                                    <button
                                        key={placeholder.token}
                                        type="button"
                                        onClick={() => copyPlaceholder(placeholder.token)}
                                        className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-slate-50 px-3 py-2 text-sm text-ink/70 transition hover:border-emerald-200 hover:bg-emerald-50"
                                    >
                                        <code className="text-xs">{placeholder.token}</code>
                                        <span>{editorLocale === 'ar' ? placeholder.labelAr : placeholder.labelEn}</span>
                                        <Copy className="h-3.5 w-3.5" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="template-preview-shell rounded-[2rem] p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                                    <MessageSquareText className="h-3.5 w-3.5" />
                                    WhatsApp Preview
                                </div>
                                <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                    {labels.live}
                                </span>
                            </div>

                            <div className="template-preview-phone rounded-[1.7rem] p-3 shadow-inner">
                                <div className="template-preview-phone-screen space-y-3 rounded-[1.4rem] p-4">
                                    <div
                                        dir={editorLocale === 'ar' ? 'rtl' : 'ltr'}
                                        className="template-preview-phone-bubble rounded-[1.2rem] px-4 py-3 text-sm leading-7 shadow-sm"
                                    >
                                        <p className={`font-semibold ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}>{previewTitle}</p>
                                        <p className={`mt-2 whitespace-pre-line ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}>{previewIntro}</p>

                                        <div className="template-preview-phone-detail mt-3 space-y-1.5 rounded-2xl px-3 py-2">
                                            {activeDefinition.previewDetails.map((detail) => (
                                                <p key={`${detail.labelAr}-${detail.valueAr}`} className={editorLocale === 'ar' ? 'text-right' : 'text-left'}>
                                                    <span className="me-1">{detail.icon}</span>
                                                    <span className="font-medium">{editorLocale === 'ar' ? detail.labelAr : detail.labelEn}</span>
                                                    {': '}
                                                    <span>{editorLocale === 'ar' ? detail.valueAr : detail.valueEn}</span>
                                                </p>
                                            ))}
                                        </div>

                                        {previewFooter ? (
                                            <p className={`mt-3 whitespace-pre-line ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}>{previewFooter}</p>
                                        ) : null}

                                        <div className={`template-preview-phone-link mt-3 rounded-2xl px-3 py-2 text-xs ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}>
                                            <p className="font-semibold">{labels.requestLink}</p>
                                            <p className="mt-1 break-all">{previewLink}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="template-preview-email-shell rounded-[2rem] p-4 shadow-sm">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                <Mail className="h-3.5 w-3.5" />
                                Email Preview
                            </div>
                            <div dir={editorLocale === 'ar' ? 'rtl' : 'ltr'} className="template-preview-email-body rounded-[1.5rem] p-4">
                                <p className={`template-preview-email-kicker text-xs uppercase tracking-[0.24em] ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}>SPHINX HR</p>
                                <h3 className={`template-preview-email-heading mt-3 text-lg font-semibold ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}>{previewTitle}</h3>
                                <p className={`template-preview-email-text mt-3 whitespace-pre-line text-sm leading-7 ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}>{previewIntro}</p>
                                {previewFooter ? (
                                    <p className={`template-preview-email-text mt-3 whitespace-pre-line text-sm leading-7 ${editorLocale === 'ar' ? 'text-right' : 'text-left'}`}>{previewFooter}</p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
