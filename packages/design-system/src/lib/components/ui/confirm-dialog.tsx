import * as React from 'react';

import { Button, type ButtonProps } from './button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from './dialog';
import { Spinner } from './spinner';

/** Props for {@link ConfirmDialog}. */
type ConfirmDialogProps = {
    /** Whether the dialog is shown. */
    open: boolean;
    /** Called to open/close; ignored while busy. */
    onOpenChange: (open: boolean) => void;
    /** Heading. */
    title: React.ReactNode;
    /** Supporting copy. */
    description: React.ReactNode;
    /** Confirm button label. */
    confirmLabel: React.ReactNode;
    /** Cancel button label; defaults to `'Cancel'` (pass a localized node). */
    cancelLabel?: React.ReactNode;
    /** Confirm button variant (e.g. `destructive` for irreversible-feeling acts). */
    confirmVariant?: ButtonProps['variant'];
    /** Disables dismissal and shows a spinner on confirm while the act is in flight. */
    busy?: boolean;
    /** Runs the confirmed action. */
    onConfirm: () => void;
};

/**
 * A small confirm/cancel modal for destructive or consequential actions. The
 * parent owns `open` and runs the action on `onConfirm`; while `busy`, the dialog
 * can't be dismissed and the confirm button shows a spinner, so a double-submit
 * can't fire a second request. i18n-free — pass localized `title`/`description`/
 * `confirmLabel` (and `cancelLabel` if the default `'Cancel'` won't do).
 */
function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancel',
    confirmVariant = 'default',
    busy = false,
    onConfirm
}: ConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!busy) onOpenChange(next);
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={confirmVariant}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy ? <Spinner /> : null}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
