import {
    act,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { Toaster } from './sonner';

/**
 * QA ORT-49 · F39, EC-25 — `🐞 BUG-design-system-08`.
 *
 * Click-the-body-to-dismiss called `toast.dismiss()` with no id, which is
 * sonner's "dismiss everything". Three toasts and one click took all three,
 * including ones the user had not read. Sonner puts no id in the DOM, but each
 * toast renders its own close button, so the clicked toast can dismiss itself.
 */
afterEach(() => {
    act(() => toast.dismiss());
});

const toasts = () =>
    Array.from(document.querySelectorAll('[data-sonner-toast]'));

async function raise(...messages: string[]) {
    render(<Toaster />);
    for (const message of messages) {
        act(() => {
            toast(message);
        });
    }
    await waitFor(() => expect(toasts()).toHaveLength(messages.length));
}

describe('Toaster', () => {
    it('dismisses only the toast whose body was clicked [design-system:I-28]', async () => {
        await raise('first', 'second', 'third');

        fireEvent.click(screen.getByText('second'));

        await waitFor(() => {
            const remaining = toasts()
                .filter((el) => el.getAttribute('data-removed') !== 'true')
                .map((el) => el.textContent);
            expect(remaining.some((t) => t?.includes('first'))).toBe(true);
            expect(remaining.some((t) => t?.includes('third'))).toBe(true);
            expect(remaining.some((t) => t?.includes('second'))).toBe(false);
        });
    });

    it('leaves the stack alone when the click misses a toast', async () => {
        await raise('first', 'second');

        fireEvent.click(document.body);

        expect(
            toasts().filter((el) => el.getAttribute('data-removed') === 'true')
        ).toHaveLength(0);
    });

    it('lets the close button own its own click [design-system:I-28]', async () => {
        await raise('first', 'second');

        const closeButton = toasts()[0].querySelector(
            '[data-close-button]'
        ) as HTMLElement;
        expect(closeButton).toBeTruthy();

        fireEvent.click(closeButton);

        await waitFor(() =>
            expect(
                toasts().filter(
                    (el) => el.getAttribute('data-removed') === 'true'
                )
            ).toHaveLength(1)
        );
    });

    /**
     * The action/cancel clause, and the observable that makes it visible.
     *
     * Sonner dismisses the toast itself when either button is pressed, so the
     * resulting DOM is the same whether `toastBodyOf` stood aside or intercepted
     * — which is why this clause sat uncovered. What differs is the *route*:
     * the wrapper's only way to dismiss one toast is to click that toast's own
     * close button, so an interception is a `click()` on a node the user never
     * touched. Spying on that node is the whole test.
     *
     * (Every other escape in `toastBodyOf` is pinned by its DOM outcome; these
     * two are the pair where the outcome is a coincidence.)
     */
    describe('the action and cancel buttons', () => {
        /**
         * Raises one toast carrying both buttons and returns a spy on its close
         * button — the node the wrapper would reach for if it intercepted.
         */
        async function raiseWithButtons() {
            const chosen: string[] = [];
            render(<Toaster />);
            act(() => {
                toast('Entry deleted', {
                    action: {
                        label: 'Undo',
                        onClick: () => chosen.push('action')
                    },
                    cancel: {
                        label: 'Dismiss',
                        onClick: () => chosen.push('cancel')
                    }
                });
            });
            await waitFor(() => expect(toasts()).toHaveLength(1));

            const closeButton = toasts()[0].querySelector(
                '[data-close-button]'
            ) as HTMLElement;
            expect(closeButton).toBeTruthy();

            return { chosen, closed: vi.spyOn(closeButton, 'click') };
        }

        afterEach(() => vi.restoreAllMocks());

        it('leaves the action button’s click to sonner [design-system:I-28]', async () => {
            const { chosen, closed } = await raiseWithButtons();

            fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

            expect(chosen).toEqual(['action']);
            // Drop `[data-action]` from `toastBodyOf`'s escape list and this is
            // 1: the wrapper reaches into the toast and presses a control the
            // user did not, on top of whatever sonner is already doing.
            expect(closed).not.toHaveBeenCalled();
        });

        it('leaves the cancel button’s click to sonner [design-system:I-28]', async () => {
            const { chosen, closed } = await raiseWithButtons();

            fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

            expect(chosen).toEqual(['cancel']);
            expect(closed).not.toHaveBeenCalled();
        });

        it('does press the close button when the body itself is clicked [design-system:I-28]', async () => {
            // The control. Without it the two cases above would pass against a
            // spy that can never fire — a wrapper with its click handler
            // deleted, or a close button sonner never rendered.
            const { closed } = await raiseWithButtons();

            fireEvent.click(screen.getByText('Entry deleted'));

            expect(closed).toHaveBeenCalledTimes(1);
        });
    });

    it('leaves a link inside the toast to navigate [design-system:I-28]', async () => {
        // The clause with no case until now. A toast that offers "Saved.
        // View entry" is one the reader is meant to click *through*, and the
        // wrapper's press-to-dismiss sits on the same element — so without the
        // `a` in `toastBodyOf`'s escape list the toast is torn down under the
        // pointer and the navigation is the last thing that happens, if it
        // happens at all.
        render(<Toaster />);
        act(() => {
            toast(
                <span>
                    Saved. <a href="#entry">View entry</a>
                </span>
            );
        });
        await waitFor(() => expect(toasts()).toHaveLength(1));

        fireEvent.click(screen.getByRole('link', { name: 'View entry' }));

        expect(toasts()[0].getAttribute('data-removed')).not.toBe('true');
    });
});
