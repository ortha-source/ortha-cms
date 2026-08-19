import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './confirm-dialog';

/**
 * QA ORT-49 · F21/F22, EC-20 — the busy gate.
 *
 * The whole reason this component exists is that a consequential action must
 * not be able to fire twice. `busy` is the gate, and a page test can only see
 * it while a request happens to be in flight.
 */
function renderDialog(
    props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}
) {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
        <ConfirmDialog
            open
            onOpenChange={onOpenChange}
            title="Remove member"
            description="This cannot be undone."
            confirmLabel="Remove"
            onConfirm={onConfirm}
            {...props}
        />
    );
    return { onConfirm, onOpenChange };
}

const confirm = () => screen.getByRole('button', { name: 'Remove' });
const cancel = () => screen.getByRole('button', { name: /Cancel|Abbrechen/ });

describe('ConfirmDialog', () => {
    it('is a dialog named and described by its own copy', () => {
        renderDialog();
        const dialog = screen.getByRole('dialog');

        // Radix emits no `aria-modal` — modality comes from the focus trap and
        // from `aria-hidden` on everything outside, which is the more robust
        // of the two mechanisms. What has to hold is the naming.
        const named = dialog.ownerDocument.getElementById(
            dialog.getAttribute('aria-labelledby') ?? ''
        );
        const described = dialog.ownerDocument.getElementById(
            dialog.getAttribute('aria-describedby') ?? ''
        );

        expect(named?.textContent).toBe('Remove member');
        expect(described?.textContent).toBe('This cannot be undone.');
    });

    it('runs the action on confirm and closes on cancel', () => {
        const { onConfirm, onOpenChange } = renderDialog();

        fireEvent.click(confirm());
        expect(onConfirm).toHaveBeenCalledTimes(1);

        fireEvent.click(cancel());
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('defaults the cancel label to English and takes a localized one', () => {
        const { unmount } = render(
            <ConfirmDialog
                open
                onOpenChange={() => undefined}
                title="t"
                description="d"
                confirmLabel="Remove"
                onConfirm={() => undefined}
            />
        );
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
        unmount();

        renderDialog({ cancelLabel: 'Abbrechen' });
        expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeTruthy();
    });

    // EC-20 — the double-submit gate.
    it('disables both buttons while busy', () => {
        renderDialog({ busy: true });

        expect((confirm() as HTMLButtonElement).disabled).toBe(true);
        expect((cancel() as HTMLButtonElement).disabled).toBe(true);
    });

    it('fires no second request from a busy confirm', () => {
        const { onConfirm } = renderDialog({ busy: true });

        fireEvent.click(confirm());
        fireEvent.click(confirm());

        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('ignores a dismissal while busy', () => {
        const { onOpenChange } = renderDialog({ busy: true });

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('allows Escape to close when it is not busy', () => {
        const { onOpenChange } = renderDialog();

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
