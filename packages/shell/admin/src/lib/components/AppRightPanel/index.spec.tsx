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
        expect(column().className).not.toContain('w-[22rem]');
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
        expect(column().className).toContain('w-[22rem]');
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
