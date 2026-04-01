'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { clearApiCache } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import ConfirmDialog from './ConfirmDialog';

type WorkflowMode = 'SANDBOX' | 'APPROVAL_WORKFLOW';

export default function WorkflowModeSwitch({
    locale,
    collapsed = false,
}: {
    locale: string;
    collapsed?: boolean;
}) {
    const { user, setUser } = useAuthStore();
    const [pendingMode, setPendingMode] = useState<WorkflowMode | null>(null);
    const [saving, setSaving] = useState(false);

    const labels = locale === 'ar'
        ? {
            title: 'وضع الطلبات',
            sandbox: 'وضع التجربة',
            workflow: 'سير الموافقات',
            sandboxHint: 'أي طلب جديد سيتم اعتماده تلقائيًا.',
            workflowHint: 'أي طلب جديد سيمر بخطوات الموافقة المعتادة.',
            enableTitle: 'تفعيل وضع التجربة؟',
            enableMessage: 'الطلبات الجديدة سيتم اعتمادها تلقائيًا بعد هذا التغيير. الطلبات الحالية لن تتأثر.',
            disableTitle: 'العودة إلى سير الموافقات؟',
            disableMessage: 'الطلبات الجديدة فقط هي التي ستعود لمسار الموافقات المعتاد. الطلبات الحالية لن تتأثر.',
            confirm: 'تأكيد',
            cancel: 'إلغاء',
            updatedSandbox: 'تم تفعيل وضع التجربة. الطلبات الجديدة ستُعتمد تلقائيًا.',
            updatedWorkflow: 'تم تفعيل سير الموافقات للطلبات الجديدة.',
            updateError: 'تعذر تحديث الوضع الحالي.',
        }
        : {
            title: 'Request Mode',
            sandbox: 'Sandbox Mode',
            workflow: 'Approval Workflow',
            sandboxHint: 'New requests are approved automatically.',
            workflowHint: 'New requests follow the normal approval workflow.',
            enableTitle: 'Enable Sandbox Mode?',
            enableMessage: 'New requests will be auto-approved after this change. Existing requests will not be affected.',
            disableTitle: 'Return to Approval Workflow?',
            disableMessage: 'Only future requests will return to the normal approval workflow. Existing requests will not be affected.',
            confirm: 'Confirm',
            cancel: 'Cancel',
            updatedSandbox: 'Sandbox Mode enabled. New requests will be auto-approved.',
            updatedWorkflow: 'Approval Workflow enabled for new requests.',
            updateError: 'Unable to update request mode.',
        };

    if (!user || user.role !== 'EMPLOYEE') return null;

    const currentMode: WorkflowMode = user.workflowMode || 'APPROVAL_WORKFLOW';
    const isSandbox = currentMode === 'SANDBOX';

    const requestToggle = () => {
        setPendingMode(isSandbox ? 'APPROVAL_WORKFLOW' : 'SANDBOX');
    };

    const confirmChange = async () => {
        if (!pendingMode || saving) return;
        setSaving(true);
        try {
            const res = await api.patch('/auth/workflow-mode', { workflowMode: pendingMode });
            clearApiCache();
            setUser(res.data?.user || { ...user, workflowMode: pendingMode });
            toast.success(pendingMode === 'SANDBOX' ? labels.updatedSandbox : labels.updatedWorkflow);
            setPendingMode(null);
        } catch (error: any) {
            toast.error(error?.message || labels.updateError);
        } finally {
            setSaving(false);
        }
    };

    const compactLabel = isSandbox ? 'SBX' : 'FLOW';

    return (
        <>
            {collapsed ? (
                <button
                    className={`workflow-mode-pill mb-2 w-full rounded-xl px-2 py-2 text-[11px] font-semibold ${isSandbox ? 'is-active' : ''}`}
                    type="button"
                    onClick={requestToggle}
                    title={`${labels.title}: ${isSandbox ? labels.sandbox : labels.workflow}`}
                    aria-label={`${labels.title}: ${isSandbox ? labels.sandbox : labels.workflow}`}
                >
                    {compactLabel}
                </button>
            ) : (
                <div className={`workflow-mode-card mb-3 rounded-2xl px-3 py-3 ${isSandbox ? 'is-active' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-ink/50">{labels.title}</p>
                            <p className="mt-1 text-sm font-semibold">{isSandbox ? labels.sandbox : labels.workflow}</p>
                            <p className="mt-1 text-xs text-ink/70">{isSandbox ? labels.sandboxHint : labels.workflowHint}</p>
                        </div>
                        <button
                            type="button"
                            className={`workflow-mode-toggle relative h-7 w-14 shrink-0 rounded-full transition-all duration-200 ${isSandbox ? 'is-active' : ''}`}
                            onClick={requestToggle}
                            aria-label={labels.title}
                            aria-pressed={isSandbox}
                        >
                            <span
                                className="workflow-mode-toggle-knob absolute top-1 h-5 w-5 rounded-full shadow-sm transition-all duration-200"
                                style={{ insetInlineStart: isSandbox ? '2rem' : '0.25rem' }}
                            />
                        </button>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!pendingMode}
                title={pendingMode === 'SANDBOX' ? labels.enableTitle : labels.disableTitle}
                message={pendingMode === 'SANDBOX' ? labels.enableMessage : labels.disableMessage}
                confirmLabel={labels.confirm}
                cancelLabel={labels.cancel}
                confirmDisabled={saving}
                onConfirm={confirmChange}
                onCancel={() => setPendingMode(null)}
            />
        </>
    );
}
