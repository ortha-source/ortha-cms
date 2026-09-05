import * as React from 'react';
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

/** One poll tick beyond the deadline, so the last scheduled tick has run. */
const POLL_INTERVAL_SLACK_MS = 200;

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

/**
 * **The silence clause** of `bootstrap:I-32` — "if nothing changes within 5
 * seconds, no announcement happens at all".
 *
 * `apps/admin-e2e/src/host/host.spec.ts` pins the other half: a second
 * navigation names the new page. It cannot reach this one, because the only way
 * to observe a *deadline* is to be on both sides of it, and a Playwright run has
 * no clock it can move.
 *
 * The fixture that matters is the one the obvious test does not build. A route
 * whose heading simply never arrives is silent whether the timeout is there or
 * not, so a case built that way passes against an announcer with
 * `POLL_TIMEOUT_MS` deleted — the shape catalogued in
 * `docs/coverage/tests-that-cannot-fail.md`. What discriminates them is a
 * heading that arrives *late*: with the deadline, the poll has already stopped
 * and the page is never announced; without it, the poll is still running and
 * announces a page the user navigated away from five seconds ago.
 */
describe('RouteAnnouncer’s five-second deadline', () => {
    let RouteAnnouncer: (typeof import('.'))['RouteAnnouncer'];

    /** The announcer's own constants, so the fixture cannot drift from them. */
    const POLL_TIMEOUT_MS = 5_000;

    /** A page whose `<h1>` appears only once `show` flips. */
    function LatePage({ show }: { show: boolean }) {
        return show ? <h1>Beta</h1> : <p>Still loading</p>;
    }

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.resetModules();
        ({ RouteAnnouncer } = await import('.'));
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    /**
     * Renders the announcer on `/alpha`, navigates to `/beta`, and hands back a
     * way to make the new page's heading appear whenever the test chooses.
     */
    function navigateToALatePage() {
        let navigate: NavigateFunction = () => undefined;
        let reveal: (value: boolean) => void = () => undefined;

        function Harness() {
            const [shown, setShown] = React.useState(false);
            reveal = setShown;
            return (
                <MemoryRouter initialEntries={['/alpha']}>
                    <RouteAnnouncer />
                    <Navigator bind={(to) => (navigate = to)} />
                    <Routes>
                        <Route path="/alpha" element={<h1>Alpha</h1>} />
                        <Route
                            path="/beta"
                            element={<LatePage show={shown} />}
                        />
                    </Routes>
                </MemoryRouter>
            );
        }

        render(<Harness />);
        // The landing page's heading is the baseline the announcer measures the
        // next one against; it is recorded on the first poll and said aloud to
        // nobody.
        act(() => {
            vi.advanceTimersByTime(200);
        });

        act(() => {
            navigate('/beta');
        });

        return { reveal: (value: boolean) => act(() => reveal(value)) };
    }

    const announced = () =>
        screen.getByTestId('route-announcer').textContent ?? '';

    it('says nothing when the heading arrives after the deadline [bootstrap:I-32]', () => {
        const { reveal } = navigateToALatePage();

        // Past the deadline with the old heading gone and no new one: the poll
        // has run itself out and unscheduled.
        act(() => {
            vi.advanceTimersByTime(POLL_TIMEOUT_MS + POLL_INTERVAL_SLACK_MS);
        });
        expect(announced()).toBe('');

        // Now the chunk lands. Nothing is watching any more, and that is the
        // point: announcing "Beta" here would speak a page the user arrived at
        // five seconds ago, over whatever they have been reading since.
        reveal(true);
        act(() => {
            vi.advanceTimersByTime(POLL_TIMEOUT_MS);
        });

        expect(announced()).toBe('');
    });

    it('announces a heading that arrives before the deadline [bootstrap:I-32]', () => {
        // The control, and the reason the case above is not vacuous: the same
        // fixture, revealed a second in, is announced.
        const { reveal } = navigateToALatePage();

        act(() => {
            vi.advanceTimersByTime(1_000);
        });
        reveal(true);
        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(announced()).toBe('Beta');
    });
});
