import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageChromeProvider, RightPanelPortal } from '../../utils/pageChrome';
import { PageActions } from '../PageActions';
import { AppRightPanel } from './index';

/**
 * The right panel's two structural rules, both of which are about the column
 * that is *not* there.
 *
 * A page registers a panel and the column appears; the page leaves and it has to
 * go — not "hidden", but zero-width and out of the accessibility tree, because a
 * 22rem strip of empty chrome beside every page in the product is the failure
 * this rule exists to prevent, and a screen-reader user tabbing into an empty
 * `complementary` landmark is the other half of it.
 *
 * The animation is gated for the same kind of reason: motion means "you just did
 * that". A panel that slid in on first paint, or every time a page registered
 * one, would be announcing something the user did not do.
 *
 * jsdom does no layout, so "zero-width" is asserted as the class that produces
 * it rather than as a measured box — the real geometry is `admin-e2e`'s. What is
 * pinned here is the branch: which of the two class sets the component chose.
 */

/** The shell's side of the panel, exactly as `AppShell` composes it. */
function Chrome({ children }: { children?: ReactNode }) {
    return (
        <IntlProvider locale="en">
            <PageChromeProvider>
                <PageActions />
                <AppRightPanel />
                {children}
            </PageChromeProvider>
        </IntlProvider>
    );
}

/** A page that registers a panel, as the entry editor's Properties does. */
function PageWithPanel() {
    return (
        <RightPanelPortal title="Properties">
            <span>Fields</span>
        </RightPanelPortal>
    );
}

const column = () => document.getElementById('app-right-panel') as HTMLElement;
const reopenButton = () => screen.queryByLabelText('Show Properties');

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('AppRightPanel', () => {
    it('takes no width and leaves the a11y tree with nothing registered [shell:I-17]', () => {
        render(<Chrome />);

        expect(column().hasAttribute('inert')).toBe(true);
        expect(column().className).toContain('w-0');
        expect(column().className).not.toContain('w-(--right-panel-width)');
        // And it offers no control either: a reopen button for a panel no page
        // registered is a button that leads nowhere.
        expect(reopenButton()).toBeNull();
    });

    it('appears exactly when a page registers one [shell:I-17]', () => {
        const { rerender } = render(<Chrome />);
        expect(column().hasAttribute('inert')).toBe(true);

        rerender(
            <Chrome>
                <PageWithPanel />
            </Chrome>
        );

        expect(column().hasAttribute('inert')).toBe(false);
        expect(column().className).toContain('w-(--right-panel-width)');
        expect(screen.getByRole('complementary', { name: 'Properties' })).toBe(
            column()
        );
    });

    it('goes away again when the page that registered it leaves [shell:I-17]', () => {
        // The other direction, and the one that leaves a permanent empty strip
        // if the registration is never released.
        const { rerender } = render(
            <Chrome>
                <PageWithPanel />
            </Chrome>
        );
        expect(column().hasAttribute('inert')).toBe(false);

        rerender(<Chrome />);

        expect(column().hasAttribute('inert')).toBe(true);
        expect(column().className).toContain('w-0');
        expect(reopenButton()).toBeNull();
    });

    it('does not animate on the first frame, nor when a page registers one [shell:I-20]', () => {
        // Open on arrival — the ordinary case, and the one an ungated transition
        // would slide in for no reason.
        const { rerender } = render(
            <Chrome>
                <PageWithPanel />
            </Chrome>
        );
        expect(column().className).not.toContain('transition-[width]');

        // And the appearance itself: a page mounting its panel is not a change
        // the user made.
        rerender(<Chrome />);
        rerender(
            <Chrome>
                <PageWithPanel />
            </Chrome>
        );
        expect(column().className).not.toContain('transition-[width]');
    });

    it('animates the change the toggle made [shell:I-20]', () => {
        // The control for the case above: "never animates" would satisfy it just
        // as well, and would be a different bug.
        render(
            <Chrome>
                <PageWithPanel />
            </Chrome>
        );

        fireEvent.click(screen.getByLabelText('Hide Properties'));

        expect(column().className).toContain('transition-[width]');
        expect(column().className).toContain('w-0');
    });
});

/** A page that asks for its panel on demand, as the entry editor's Details does. */
function PageWithOverlay() {
    return (
        <RightPanelPortal title="Details" overlay>
            <button type="button">Inside</button>
        </RightPanelPortal>
    );
}

describe('AppRightPanel — overlay', () => {
    const showDetails = () => screen.queryByLabelText('Show Details');

    it('starts closed and floats over the page when opened', () => {
        render(
            <Chrome>
                <PageWithOverlay />
            </Chrome>
        );
        expect(column().dataset['mode']).toBe('overlay');
        expect(column().hasAttribute('inert')).toBe(true);

        fireEvent.click(showDetails() as HTMLElement);

        expect(column().hasAttribute('inert')).toBe(false);
        expect(column().className).toContain('fixed');
        // A floating card takes no width from the page.
        expect(column().className).not.toContain('w-0');
    });

    it('keeps its toggle in the top bar while open, since it has no column', () => {
        render(
            <Chrome>
                <PageWithOverlay />
            </Chrome>
        );
        fireEvent.click(showDetails() as HTMLElement);

        // The bar's toggle is still there, now saying what it will do.
        const barToggle = screen
            .getAllByLabelText('Hide Details')
            .find((button) => button.getAttribute('aria-expanded') === 'true');
        expect(barToggle).toBeDefined();
        expect(showDetails()).toBeNull();

        fireEvent.click(barToggle as HTMLElement);
        expect(column().hasAttribute('inert')).toBe(true);
        expect(showDetails()).not.toBeNull();
    });

    it('closes on a click outside, but not on one inside', () => {
        render(
            <Chrome>
                <PageWithOverlay />
                <p>Form</p>
            </Chrome>
        );
        fireEvent.click(showDetails() as HTMLElement);

        fireEvent.pointerDown(screen.getByText('Inside'));
        expect(column().hasAttribute('inert')).toBe(false);

        fireEvent.pointerDown(screen.getByText('Form'));
        expect(column().hasAttribute('inert')).toBe(true);
    });

    it('closes on Escape', () => {
        render(
            <Chrome>
                <PageWithOverlay />
            </Chrome>
        );
        fireEvent.click(showDetails() as HTMLElement);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(column().hasAttribute('inert')).toBe(true);
    });

    it('pins into a docked column, and the pin outlives the page', () => {
        const { unmount } = render(
            <Chrome>
                <PageWithOverlay />
            </Chrome>
        );
        fireEvent.click(showDetails() as HTMLElement);
        fireEvent.click(screen.getByLabelText('Pin Details beside the page'));

        expect(column().dataset['mode']).toBe('docked');
        expect(column().className).toContain('w-(--right-panel-width)');
        expect(window.localStorage.getItem('orthacms:right-panel:pinned')).toBe(
            'true'
        );
        unmount();

        render(
            <Chrome>
                <PageWithOverlay />
            </Chrome>
        );
        // Docked and open on arrival, as a pinned column is.
        expect(column().dataset['mode']).toBe('docked');
        expect(column().hasAttribute('inert')).toBe(false);
        expect(
            screen.getByLabelText('Unpin Details').getAttribute('aria-pressed')
        ).toBe('true');
    });

    it('offers no pin to a page that did not ask for the overlay', () => {
        render(
            <Chrome>
                <PageWithPanel />
            </Chrome>
        );
        expect(column().dataset['mode']).toBe('docked');
        expect(screen.queryByLabelText(/Pin Properties/)).toBeNull();
    });
});
