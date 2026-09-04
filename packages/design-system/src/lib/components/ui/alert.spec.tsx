import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert, AlertDescription, AlertTitle } from './alert';

/**
 * ORT-168 — the banner's name, which until now rested entirely on an axe run
 * happening to land on a page that renders an `Alert`.
 *
 * `Alert` mints an id and writes `aria-labelledby` **only after** an
 * `AlertTitle` reports that it mounted, and several banners in the admin render
 * a description and nothing else. Writing the attribute unconditionally would
 * point it at an id that is on no element — `aria-valid-attr-value`, i.e.
 * strictly worse than the unnamed banner it replaced, and a state axe reports
 * as a violation rather than as the missing-name warning it used to be.
 */
describe('Alert', () => {
    it('writes no aria-labelledby when the banner has no title [design-system:I-15]', () => {
        render(
            <Alert>
                <AlertDescription>The import finished.</AlertDescription>
            </Alert>
        );

        const banner = screen.getByRole('alert');
        expect(banner.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('names itself from the title once one has mounted [design-system:I-15]', () => {
        render(
            <Alert>
                <AlertTitle>Import failed</AlertTitle>
                <AlertDescription>Three rows were rejected.</AlertDescription>
            </Alert>
        );

        const banner = screen.getByRole('alert');
        const titleId = banner.getAttribute('aria-labelledby');

        expect(titleId).toBeTruthy();
        // The half that separates a correct reference from a dangling one:
        // the id has to be *on* the title, not merely present on the banner.
        expect(document.getElementById(titleId as string)?.textContent).toBe(
            'Import failed'
        );
        expect(
            screen.getByRole('alert', { name: 'Import failed' })
        ).toBeTruthy();
    });

    it('picks the reference up when the title appears later [design-system:I-15]', () => {
        // The banner is mounted first and the title arrives on a re-render —
        // an async error message dropped into an already-visible callout. The
        // `onMount` callback is what closes that gap; without it the attribute
        // is decided once, at first paint, and never again.
        const { rerender } = render(
            <Alert>
                <AlertDescription>Saving…</AlertDescription>
            </Alert>
        );
        expect(screen.getByRole('alert').hasAttribute('aria-labelledby')).toBe(
            false
        );

        rerender(
            <Alert>
                <AlertTitle>Could not save</AlertTitle>
                <AlertDescription>Saving…</AlertDescription>
            </Alert>
        );

        expect(
            screen.getByRole('alert', { name: 'Could not save' })
        ).toBeTruthy();
    });

    it('lets a caller point the name somewhere else', () => {
        // `{...props}` is spread after the generated attribute, so a page that
        // knows a better name than its own title keeps it — but only through
        // `aria-labelledby`. An `aria-label` passed here does **not** win:
        // `aria-labelledby` outranks it in the accessible-name algorithm and
        // the generated one is still on the element. The component's own
        // comment claims either overrides; only this one does.
        render(
            <div>
                <span id="banner-name">Import summary</span>
                <Alert aria-labelledby="banner-name">
                    <AlertTitle>Import failed</AlertTitle>
                </Alert>
            </div>
        );

        expect(
            screen.getByRole('alert', { name: 'Import summary' })
        ).toBeTruthy();
    });

    it('gives a bare AlertTitle no id to collide with', () => {
        // Outside an `Alert` the context is `null`, so the title takes no id
        // rather than one nothing points at.
        const { container } = render(<AlertTitle>Orphan</AlertTitle>);
        const title = container.querySelector('[data-slot="alert-title"]');

        expect(title?.hasAttribute('id')).toBe(false);
    });
});
