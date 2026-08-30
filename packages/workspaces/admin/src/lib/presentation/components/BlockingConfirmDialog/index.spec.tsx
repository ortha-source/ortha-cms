import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    BlockingConfirmDialog,
    type BlockingConfirmDialogProps
} from './index';

const CONFIRM_LABEL = 'Delete workspace';

/**
 * Renders the dialog open, with the count-query state under test. Everything
 * else is fixed copy — the component's only decision is which of the three
 * states it shows and whether the destructive button is reachable.
 */
function renderDialog(state: {
    isChecking: boolean;
    isError: boolean;
    count: number | undefined;
    busy?: boolean;
}) {
    const props: BlockingConfirmDialogProps = {
        open: true,
        title: 'Delete this workspace?',
        description: 'This cannot be undone.',
        checkingLabel: 'Checking for content…',
        checkErrorLabel: 'Couldn’t check for content.',
        blockedLabel: 'This workspace still holds content.',
        confirmLabel: CONFIRM_LABEL,
        cancelLabel: 'Cancel',
        onClose: () => undefined,
        onConfirm: () => undefined,
        ...state
    };

    return render(<BlockingConfirmDialog {...props} />);
}

/**
 * Whether the destructive button — the whole subject of these tests — is shut.
 * Read off the DOM rather than through `jest-dom`: this package registers no
 * setup file, so its matchers are not installed here.
 */
const confirmIsDisabled = () =>
    (screen.getByRole('button', { name: CONFIRM_LABEL }) as HTMLButtonElement)
        .disabled;

/**
 * The shared block-before-you-act gate. It stands in front of the two
 * irreversible actions in this plugin — deleting a workspace and revoking a
 * content grant — and its rule is narrow on purpose: the confirm button opens
 * **only** on a known zero. The server's `409` is the safety net, not the gate,
 * so anything short of "we asked, and the answer was none" has to stay shut.
 *
 * The two "not yet known" states are the ones worth pinning. `count` is
 * `undefined` while the query is in flight and after it fails, so a rule phrased
 * as the negation of the warning — `!hasEntries` — or a later refactor that
 * drops the `isError` / `isChecking` terms would read "we could not find out" as "there is nothing
 * there" and hand someone an enabled Delete on a workspace full of content.
 *
 * `open` is the fourth term in `canConfirm` and is deliberately untested: Radix
 * mounts no content while closed, so there is no button to assert on and the
 * term can only ever be belt-and-braces.
 */
describe('BlockingConfirmDialog', () => {
    it('blocks the action while the count is still being checked', () => {
        renderDialog({ isChecking: true, isError: false, count: undefined });

        expect(confirmIsDisabled()).toBe(true);
        expect(screen.getByText('Checking for content…')).toBeTruthy();
    });

    it('blocks the action when the count could not be read', () => {
        renderDialog({ isChecking: false, isError: true, count: undefined });

        expect(confirmIsDisabled()).toBe(true);
        expect(screen.getByRole('alert').textContent).toContain(
            'Couldn’t check for content.'
        );
    });

    // The settled, non-error case that is still not an answer — no query state
    // says "checking", yet nothing came back. Without the `count === 0` term
    // this is the case that silently unblocks.
    it('blocks the action when no count arrived at all', () => {
        renderDialog({ isChecking: false, isError: false, count: undefined });

        expect(confirmIsDisabled()).toBe(true);
    });

    it('blocks the action while the count is above zero', () => {
        renderDialog({ isChecking: false, isError: false, count: 3 });

        expect(confirmIsDisabled()).toBe(true);
        expect(screen.getByRole('alert').textContent).toContain(
            'This workspace still holds content.'
        );
    });

    it('allows the action only on a known zero, with no warning shown', () => {
        renderDialog({ isChecking: false, isError: false, count: 0 });

        expect(confirmIsDisabled()).toBe(false);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    // A known zero is necessary but not sufficient: a second click while the
    // delete is already in flight would fire the destructive request twice.
    it('closes the gate again while the action is in flight', () => {
        renderDialog({
            isChecking: false,
            isError: false,
            count: 0,
            busy: true
        });

        expect(confirmIsDisabled()).toBe(true);
    });
});
