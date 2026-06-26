import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Spinner,
    type ButtonProps
} from '@ortha-cms/design-system';

/** Intl descriptors for {@link ConfirmDialog}, co-located with the component. */
const messages = defineMessages({
    cancel: { id: 'content.confirm.cancel', defaultMessage: 'Cancel' }
});

/**
 * A small confirm/cancel modal for the Content Library's destructive actions
 * (delete an entry, bulk delete, permanently delete). The parent owns `open` and
 * runs the action on `onConfirm`; while `busy`, the dialog can't be dismissed and
 * the confirm button shows a spinner, so a double-submit can't fire a second
 * request. Mirrors `users-admin`'s `ConfirmDialog` (there is no design-system
 * `AlertDialog` primitive).
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel,
    confirmVariant = 'default',
    busy = false,
    onConfirm
}: {
    /** Whether the dialog is shown. */
    open: boolean;
    /** Called to open/close; ignored while busy. */
    onOpenChange: (open: boolean) => void;
    /** Heading. */
    title: ReactNode;
    /** Supporting copy. */
    description: ReactNode;
    /** Confirm button label. */
    confirmLabel: ReactNode;
    /** Cancel button label; defaults to a translated "Cancel". */
    cancelLabel?: ReactNode;
    /** Confirm button variant (e.g. `destructive` for irreversible-feeling acts). */
    confirmVariant?: ButtonProps['variant'];
    /** Disables dismissal and shows a spinner on confirm while the act is in flight. */
    busy?: boolean;
    /** Runs the confirmed action. */
    onConfirm: () => void;
}) {
    const intl = useIntl();

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
                        {cancelLabel ?? intl.formatMessage(messages.cancel)}
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
