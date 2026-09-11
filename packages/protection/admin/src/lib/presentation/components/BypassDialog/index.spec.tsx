import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishOutlook } from '../../../domain/types';
import { BypassDialog } from './index';

// jsdom implements none of the browser APIs Radix's dialog reaches for.
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

const outlook: PublishOutlook = {
    required: 2,
    given: 0,
    blocked: true,
    bypassable: true
};

const onConfirm = vi.fn();
const onOpenChange = vi.fn();

function draw() {
    return render(
        <IntlProvider locale="en">
            <BypassDialog
                open
                onOpenChange={onOpenChange}
                outlook={outlook}
                onConfirm={onConfirm}
            />
        </IntlProvider>
    );
}

const confirm = () => screen.getByRole('button', { name: /publish anyway/i });

describe('BypassDialog', () => {
    beforeEach(() => {
        onConfirm.mockReset();
        onOpenChange.mockReset();
    });

    it('says how far short the count is', () => {
        draw();

        expect(screen.getByText(/needs 2 approvals, and has 0/i)).toBeTruthy();
    });

    /** Said before the click, not after it. */
    it('names the log row the bypass will write, up front', () => {
        draw();

        expect(screen.getByText(/entry\.publish_bypassed/)).toBeTruthy();
    });

    /**
     * The two halves of one decision: an empty reason must not publish, and the
     * refusal must be something a person *hears*. A disabled button would do the
     * first and none of the second.
     */
    it('refuses an empty reason without publishing, and says why', () => {
        draw();

        expect(confirm().hasAttribute('disabled')).toBe(false);
        fireEvent.click(confirm());

        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByRole('alert').textContent).toMatch(
            /reason is required/i
        );
    });

    it('treats whitespace as empty', () => {
        draw();

        fireEvent.change(screen.getByLabelText(/reason/i), {
            target: { value: '   ' }
        });
        fireEvent.click(confirm());

        expect(onConfirm).not.toHaveBeenCalled();
    });

    /**
     * It hands the reason over rather than publishing: the editor's own publish
     * is what saves the edits on screen, or creates the record on a create form.
     */
    it('hands the trimmed reason to the editor’s publish and closes', () => {
        draw();

        fireEvent.change(screen.getByLabelText(/reason/i), {
            target: { value: '  numbers corrected before the send  ' }
        });
        fireEvent.click(confirm());

        expect(onConfirm).toHaveBeenCalledWith(
            'numbers corrected before the send'
        );
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('labels the reason field rather than relying on its placeholder', () => {
        draw();

        expect(screen.getByLabelText(/reason/i)).toBeTruthy();
    });
});
