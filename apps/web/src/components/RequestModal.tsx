'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { uploadToCloudinary } from '@/lib/upload';
import { useTranslations } from 'next-intl';

type DynamicForm = {
    id: string;
    name: string;
    nameAr: string;
    fields: Array<{
        id: string;
        label: string;
        labelAr: string;
        fieldType: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'TIME' | 'SELECT' | 'CHECKBOX' | 'FILE';
        options?: string[];
        isRequired?: boolean;
    }>;
};

type Props = {
    open: boolean;
    locale: 'en' | 'ar';
    date: Date | null;
    onClose: () => void;
    onSubmitted: () => void;
};

export default function RequestModal({ open, locale, date, onClose, onSubmitted }: Props) {
    const t = useTranslations('requests');
    const [type, setType] = useState<'leave' | 'permission' | 'form'>('leave');
    const [forms, setForms] = useState<DynamicForm[]>([]);
    const [selectedForm, setSelectedForm] = useState<DynamicForm | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        api.get('/forms').then((res) => setForms(res.data));
    }, [open]);

    useEffect(() => {
        if (!selectedForm) setFormData({});
    }, [selectedForm]);

    const dateValue = useMemo(() => (date ? date.toISOString().slice(0, 10) : ''), [date]);

    if (!open) return null;

    const submit = async () => {
        if (!date) return;
        setLoading(true);
        try {
            if (type === 'leave') {
                await api.post('/leaves', {
                    leaveType: formData.leaveType || 'ANNUAL',
                    startDate: formData.startDate || dateValue,
                    endDate: formData.endDate || dateValue,
                    reason: formData.reason || '',
                    attachmentUrl: formData.attachmentUrl,
                });
            } else if (type === 'permission') {
                await api.post('/permissions', {
                    permissionType: formData.permissionType || 'LATE_ARRIVAL',
                    requestDate: dateValue,
                    arrivalTime: formData.arrivalTime,
                    leaveTime: formData.leaveTime,
                    reason: formData.reason || '',
                });
            } else if (type === 'form' && selectedForm) {
                await api.post(`/forms/${selectedForm.id}/submit`, { data: formData });
            }

            onSubmitted();
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const onFileChange = async (fieldId: string, file?: File) => {
        if (!file) return;
        setLoading(true);
        try {
            const url = await uploadToCloudinary(file, 'sphinx-hr/forms');
            setFormData((prev) => ({ ...prev, [fieldId]: url }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="card w-full max-w-2xl p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{t('new')}</h2>
                    <button className="btn-outline" onClick={onClose}>Close</button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button className={`btn-outline ${type === 'leave' ? 'bg-ink/10' : ''}`} onClick={() => setType('leave')}>
                        {t('leave')}
                    </button>
                    <button className={`btn-outline ${type === 'permission' ? 'bg-ink/10' : ''}`} onClick={() => setType('permission')}>
                        {t('permission')}
                    </button>
                    <button className={`btn-outline ${type === 'form' ? 'bg-ink/10' : ''}`} onClick={() => setType('form')}>
                        {t('form')}
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    {type === 'leave' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    Leave Type
                                    <select
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => setFormData((p) => ({ ...p, leaveType: e.target.value }))}
                                    >
                                        <option value="ANNUAL">Annual</option>
                                        <option value="EMERGENCY">Emergency</option>
                                        <option value="MISSION">Mission</option>
                                    </select>
                                </label>
                                <label className="text-sm">
                                    Start Date
                                    <input
                                        type="date"
                                        defaultValue={dateValue}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                                    />
                                </label>
                                <label className="text-sm">
                                    End Date
                                    <input
                                        type="date"
                                        defaultValue={dateValue}
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                                    />
                                </label>
                            </div>
                            <label className="text-sm">
                                Reason
                                <textarea
                                    rows={3}
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))}
                                />
                            </label>
                        </>
                    )}

                    {type === 'permission' && (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    Permission Type
                                    <select
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => setFormData((p) => ({ ...p, permissionType: e.target.value }))}
                                    >
                                        <option value="LATE_ARRIVAL">Late Arrival</option>
                                        <option value="EARLY_LEAVE">Early Leave</option>
                                    </select>
                                </label>
                                <label className="text-sm">
                                    Arrival Time
                                    <input
                                        type="time"
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => setFormData((p) => ({ ...p, arrivalTime: e.target.value }))}
                                    />
                                </label>
                                <label className="text-sm">
                                    Leave Time
                                    <input
                                        type="time"
                                        className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                        onChange={(e) => setFormData((p) => ({ ...p, leaveTime: e.target.value }))}
                                    />
                                </label>
                            </div>
                            <label className="text-sm">
                                Reason
                                <textarea
                                    rows={3}
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))}
                                />
                            </label>
                        </>
                    )}

                    {type === 'form' && (
                        <>
                            <label className="text-sm">
                                Select Form
                                <select
                                    className="mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2"
                                    onChange={(e) => {
                                        const form = forms.find((f) => f.id === e.target.value) || null;
                                        setSelectedForm(form);
                                    }}
                                >
                                    <option value="">Choose...</option>
                                    {forms.map((form) => (
                                        <option key={form.id} value={form.id}>
                                            {locale === 'ar' ? form.nameAr : form.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {selectedForm?.fields.map((field) => {
                                const label = locale === 'ar' ? field.labelAr : field.label;
                                const commonClass = 'mt-1 w-full rounded-xl border border-ink/20 bg-white px-3 py-2';
                                if (field.fieldType === 'TEXTAREA') {
                                    return (
                                        <label key={field.id} className="text-sm">
                                            {label}
                                            <textarea
                                                rows={3}
                                                className={commonClass}
                                                onChange={(e) => setFormData((p) => ({ ...p, [field.id]: e.target.value }))}
                                            />
                                        </label>
                                    );
                                }
                                if (field.fieldType === 'SELECT') {
                                    return (
                                        <label key={field.id} className="text-sm">
                                            {label}
                                            <select
                                                className={commonClass}
                                                onChange={(e) => setFormData((p) => ({ ...p, [field.id]: e.target.value }))}
                                            >
                                                <option value="">Choose...</option>
                                                {(field.options || []).map((opt) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </label>
                                    );
                                }
                                if (field.fieldType === 'CHECKBOX') {
                                    return (
                                        <label key={field.id} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => setFormData((p) => ({ ...p, [field.id]: e.target.checked }))}
                                            />
                                            {label}
                                        </label>
                                    );
                                }
                                if (field.fieldType === 'FILE') {
                                    return (
                                        <label key={field.id} className="text-sm">
                                            {label}
                                            <input
                                                type="file"
                                                className="mt-1 w-full"
                                                onChange={(e) => onFileChange(field.id, e.target.files?.[0])}
                                            />
                                        </label>
                                    );
                                }
                                return (
                                    <label key={field.id} className="text-sm">
                                        {label}
                                        <input
                                            type={field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : field.fieldType === 'TIME' ? 'time' : 'text'}
                                            className={commonClass}
                                            onChange={(e) => setFormData((p) => ({ ...p, [field.id]: e.target.value }))}
                                        />
                                    </label>
                                );
                            })}
                        </>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button className="btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={submit} disabled={loading}>
                        {loading ? 'Saving...' : 'Submit'}
                    </button>
                </div>
            </div>
        </div>
    );
}
