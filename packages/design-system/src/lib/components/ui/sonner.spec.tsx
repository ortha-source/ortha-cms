import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
    it('dismisses only the toast whose body was clicked', async () => {
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

    it('lets the close button own its own click', async () => {
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
});
