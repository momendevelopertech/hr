'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type ConfirmDialogProps = {
    open: boolean;
    title?: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    confirmDisabled?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel,
    confirmDisabled,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open || typeof document === 'undefined') return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onCancel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onCancel, open]);

    if (!open || !mounted || typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="overlay-backdrop fixed inset-0 z-[100] flex items-center justify-center px-4"
            onClick={onCancel}
            role="presentation"
        >
            <div
                className="modal-shell w-full max-w-md rounded-3xl p-6"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'confirm-dialog-title' : undefined}
            >
                {title && <h3 className="text-lg font-semibold" id="confirm-dialog-title">{title}</h3>}
                <p className={`text-sm text-ink/70 ${title ? 'mt-2' : ''}`}>{message}</p>
                <div className="mt-5 flex justify-end gap-2">
                    <button className="btn-outline" onClick={onCancel} type="button">{cancelLabel}</button>
                    <button className="btn-primary" onClick={onConfirm} disabled={confirmDisabled} type="button">
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
