'use client';

import { useCallback, useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

type AsyncActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> & {
    onClick: (event: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
    children: ReactNode;
    pendingLabel?: ReactNode;
    externalPending?: boolean;
};

export default function AsyncActionButton({
    onClick,
    children,
    pendingLabel,
    disabled,
    externalPending = false,
    ...props
}: AsyncActionButtonProps) {
    const [internalPending, setInternalPending] = useState(false);
    const clickLockRef = useRef(false);
    const isPending = internalPending || externalPending;

    const handleClick = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (isPending || disabled || clickLockRef.current) return;
        clickLockRef.current = true;
        setInternalPending(true);
        try {
            await onClick(event);
        } finally {
            setInternalPending(false);
            clickLockRef.current = false;
        }
    }, [disabled, isPending, onClick]);

    return (
        <button
            {...props}
            type={props.type ?? 'button'}
            onClick={handleClick}
            disabled={disabled || isPending}
            aria-busy={isPending}
        >
            {isPending ? (pendingLabel || children) : children}
        </button>
    );
}
