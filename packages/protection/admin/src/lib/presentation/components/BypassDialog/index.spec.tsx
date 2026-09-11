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

    /** Reasons were removed with review notes: there is nothing to fill in. */
    it('asks for no reason', () => {
        draw();

        expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('confirms and closes', () => {
        draw();

        fireEvent.click(
            screen.getByRole('button', { name: /publish anyway/i })
        );

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('cancels without confirming', () => {
        draw();

        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
