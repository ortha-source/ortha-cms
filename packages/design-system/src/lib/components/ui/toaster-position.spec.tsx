import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Toaster } from './sonner';

/**
 * Where the toasts sit, and — the part that actually matters — *who decided*.
 *
 * `copilot-admin` suppresses a toast while its dock is open, because a
 * bottom-right toast would cover the composer to announce something already on
 * screen. That reasoning is only sound while the corner is a property of
 * `Toaster`; moving it would silently invalidate a decision taken in another
 * package. The corner used to be declared in two places and disagree — this
 * component's own doc said top-right while `createAdmin` passed
 * `position="bottom-right"` — and because `{...props}` is spread last, the host
 * won and the documentation was simply wrong.
 *
 * **Read this before replacing it with a DOM assertion.** Sonner's own default
 * is `bottom-right` too, so rendering `<Toaster />` and reading
 * `data-y-position` off `[data-sonner-toaster]` passes identically whether or
 * not this component states the position at all — a correct `Toaster` and one
 * that had lost the prop look the same through that window. What separates
 * them is the prop `Toaster` hands down, so that is what is captured.
 */
const captured = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('sonner', async (importOriginal) => {
    const actual = await importOriginal<typeof import('sonner')>();
    return {
        ...actual,
        Toaster: (props: Record<string, unknown>) => {
            captured.push(props);
            return null;
        }
    };
});

const lastProps = () => captured[captured.length - 1];

describe('Toaster', () => {
    it('pins the toasts to the bottom right itself [design-system:I-29]', () => {
        render(<Toaster />);

        expect(lastProps().position).toBe('bottom-right');
    });

    it('keeps a consumer override possible, and therefore deliberate [design-system:I-29]', () => {
        // The prop spread stays last on purpose: a deployment that really does
        // want another corner can have one, and it is then a change to a
        // shared decision rather than a local one.
        render(<Toaster position="top-center" />);

        expect(lastProps().position).toBe('top-center');
    });
});
