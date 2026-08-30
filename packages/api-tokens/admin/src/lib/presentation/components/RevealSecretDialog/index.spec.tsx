import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RevealSecretDialog } from './index';

// jsdom implements none of the browser APIs the Radix dialog primitives reach
// for, and this package registers no vitest setup file, so the shims the
// design-system's own suite installs globally are installed here instead —
// without them the dialog throws before any assertion is reached.
if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    })) as typeof window.matchMedia;
}

if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
        observe() {
            return undefined;
        }
        unobserve() {
            return undefined;
        }
        disconnect() {
            return undefined;
        }
    } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
}

const SECRET = 'ort_live_supersecret';

const DONE = 'Done';
const COPY = 'Copy';
const KEEP_OPEN = 'Keep it open';
const CLOSE_ANYWAY = 'Close without copying';
const UNCOPIED_WARNING = 'You haven’t copied the token yet';

/** The clipboard the component writes to; jsdom ships none at all. */
const writeText = vi.fn<(text: string) => Promise<void>>();

Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (text: string) => writeText(text) }
});

function renderDialog() {
    const onOpenChange = vi.fn();

    render(
        <IntlProvider locale="en" onError={() => undefined}>
            <RevealSecretDialog
                secret={SECRET}
                open
                onOpenChange={onOpenChange}
            />
        </IntlProvider>
    );

    return { onOpenChange };
}

const button = (name: string) => screen.getByRole('button', { name });

/** Whether the "you haven't copied it yet" guard is currently on screen. */
const isConfirming = () =>
    screen.queryByText(new RegExp(UNCOPIED_WARNING)) !== null;

/** Clicks Copy and waits for the component to register the success. */
async function copy() {
    fireEvent.click(button(COPY));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRET));
}

/**
 * The one-time reveal. The plaintext lives only in the parent's state and is
 * never re-fetchable, so a dismissal that beats the copy loses the credential
 * outright — the admin's only recovery is minting a replacement, which leaves a
 * live orphan token behind.
 *
 * The component's answer is `requestClose`: a single funnel every dismissal
 * goes through, including Radix's own `onOpenChange` (Esc, the overlay, the
 * corner X), so no path can slip past the guard. These tests pin that
 * invariant from both directions — uncopied never leaves without an explicit
 * confirmation, copied never asks.
 */
describe('RevealSecretDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        writeText.mockResolvedValue(undefined);
    });

    it('asks before discarding a secret that has not been copied', () => {
        const { onOpenChange } = renderDialog();

        fireEvent.click(button(DONE));

        expect(isConfirming()).toBe(true);
        // The parent still holds the secret: nothing was dismissed, so the
        // dialog is still the user's chance to copy it.
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    // Esc is the reflex dismissal, and it reaches Radix's `onOpenChange` rather
    // than any button in this component — the exact path a guard wired only to
    // the footer button would miss.
    it('asks on Esc too, not only on the footer button', () => {
        const { onOpenChange } = renderDialog();

        fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });

        expect(isConfirming()).toBe(true);
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('returns to the secret when the confirmation is declined', () => {
        const { onOpenChange } = renderDialog();
        fireEvent.click(button(DONE));

        fireEvent.click(button(KEEP_OPEN));

        expect(isConfirming()).toBe(false);
        expect(onOpenChange).not.toHaveBeenCalled();
        // Back to the state that lets the token be copied: the field still
        // holds it and Copy is the offer again.
        expect(
            (screen.getByLabelText('API token secret') as HTMLInputElement)
                .value
        ).toBe(SECRET);
        expect(button(DONE)).toBeTruthy();
    });

    it('closes when the confirmation is accepted', () => {
        const { onOpenChange } = renderDialog();
        fireEvent.click(button(DONE));

        fireEvent.click(button(CLOSE_ANYWAY));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('closes without asking once the secret has been copied', async () => {
        const { onOpenChange } = renderDialog();
        await copy();

        fireEvent.click(button(DONE));

        // The guard exists to stop a loss, not to nag: once the credential is
        // safely on the clipboard a second click would be pure friction.
        expect(isConfirming()).toBe(false);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    /**
     * The clipboard write can be refused outright — an insecure origin, a
     * denied permission, an unfocused document. The component reports that with
     * a toast, and the state it must *not* reach is "copied": treating a
     * rejected write as a copy would drop the guard on the one press where the
     * secret genuinely did not make it anywhere.
     */
    it('does not count a refused clipboard write as a copy', async () => {
        writeText.mockRejectedValue(new Error('clipboard blocked'));
        const { onOpenChange } = renderDialog();

        fireEvent.click(button(COPY));
        await waitFor(() => expect(writeText).toHaveBeenCalled());

        fireEvent.click(button(DONE));

        expect(isConfirming()).toBe(true);
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});
