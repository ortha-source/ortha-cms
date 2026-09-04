import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The announcer's one restraint: it names the new view and leaves focus alone.
 *
 * `apps/admin-e2e/src/host/host.spec.ts` covers what it *says* — the region is
 * mounted and empty before the first navigation, a second navigation names the
 * new page. Nothing covers what it must not do, and "announce a route change" is
 * exactly the requirement people satisfy by moving focus to the new heading,
 * which is what the shell's skip link and each page's own focus handling exist
 * to do instead (identity's auth screens focus their heading; a page opening an
 * editor may want the first field). Taking focus at the host would fight all of
 * them, silently.
 */

/** Hands the test the router's `navigate`, so nothing has to click a link. */
function Navigator({ bind }: { bind: (to: NavigateFunction) => void }) {
    bind(useNavigate());
    return null;
}

describe('RouteAnnouncer', () => {
    /**
     * A fresh module per case.
     *
     * The announcer keeps "what path and heading did I last see" at **module**
     * level rather than in a ref, deliberately — React 19's `StrictMode` remounts
     * effects, and a ref would be re-created by that remount, so the silent first
     * render would announce the landing page on the second pass. One host runs
     * per document, so the lifetime is right in the app and wrong in a spec file:
     * without this, the second case in this file starts with the first case's
     * heading already recorded and its landing page counts as a navigation.
     */
    let RouteAnnouncer: (typeof import('.'))['RouteAnnouncer'];

    beforeEach(async () => {
        vi.resetModules();
        ({ RouteAnnouncer } = await import('.'));
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('announces the arriving page without taking focus [bootstrap:I-33]', async () => {
        let navigate: NavigateFunction = () => undefined;

        render(
            <MemoryRouter initialEntries={['/alpha']}>
                <RouteAnnouncer />
                <Navigator bind={(to) => (navigate = to)} />
                {/* Somewhere for focus to be, and somewhere an announcer that
                    moved it would visibly take it from. */}
                <button type="button">Open menu</button>
                <Routes>
                    <Route path="/alpha" element={<h1>Alpha</h1>} />
                    <Route path="/beta" element={<h1>Beta</h1>} />
                </Routes>
            </MemoryRouter>
        );

        const button = screen.getByRole('button');
        button.focus();
        expect(document.activeElement).toBe(button);

        await act(async () => {
            navigate('/beta');
        });

        // Wait for the announcement itself first. Without it the focus assertion
        // would hold for an announcer that never ran at all, which is the same
        // shape as a test that cannot fail — it is only interesting that focus
        // stayed put *while* the announcer did its work.
        await waitFor(() =>
            expect(screen.getByTestId('route-announcer').textContent).toBe(
                'Beta'
            )
        );

        expect(document.activeElement).toBe(button);
    });
});
