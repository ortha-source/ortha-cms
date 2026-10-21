import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { isPageChange, PageTransitionRouter } from './index';

describe('isPageChange', () => {
    it.each([
        ['/users', '/webhooks', true],
        ['/users', '/users/1/profile', true],
        ['/workspaces/a/content/post', '/workspaces/a/media', true],
        [
            '/workspaces/a/settings/general',
            '/workspaces/b/settings/general',
            true
        ]
    ])('%s → %s is a page change', (from, to, expected) => {
        expect(isPageChange(from, to)).toBe(expected);
    });

    it.each([
        ['/users', '/users'],
        ['/users/1/profile', '/users/1/sessions'],
        ['/workspaces/a/settings/general', '/workspaces/a/settings/members']
    ])('%s → %s is a change within a page', (from, to) => {
        expect(isPageChange(from, to)).toBe(false);
    });
});

function Nav({ to }: { to: string }) {
    const navigate = useNavigate();
    return (
        <button type="button" onClick={() => navigate(to)}>
            go {to}
        </button>
    );
}

function App() {
    return (
        <PageTransitionRouter>
            <Routes>
                <Route path="/" element={<Nav to="/users" />} />
                <Route path="/users" element={<p>users page</p>} />
            </Routes>
        </PageTransitionRouter>
    );
}

describe('PageTransitionRouter', () => {
    afterEach(() => {
        delete (document as { startViewTransition?: unknown })
            .startViewTransition;
        document.documentElement.removeAttribute('data-ds-page-transition');
        window.history.replaceState(null, '', '/');
    });

    it('navigates plainly where View Transitions are not supported', () => {
        render(<App />);
        act(() => screen.getByRole('button').click());
        expect(screen.getByText('users page')).toBeTruthy();
    });

    it('commits a page change inside a view transition, flagging the document for its length', async () => {
        let finish: () => void = () => undefined;
        const start = vi.fn((update: () => void) => {
            // The browser snapshots first, then runs the update.
            expect(
                document.documentElement.hasAttribute('data-ds-page-transition')
            ).toBe(true);
            update();
            return {
                ready: Promise.resolve(),
                updateCallbackDone: Promise.resolve(),
                finished: new Promise<void>((resolve) => {
                    finish = resolve;
                }),
                skipTransition: () => undefined
            };
        });
        (document as { startViewTransition?: unknown }).startViewTransition =
            start;

        render(<App />);
        act(() => screen.getByRole('button').click());

        expect(start).toHaveBeenCalledTimes(1);
        expect(screen.getByText('users page')).toBeTruthy();

        await act(async () => finish());
        expect(
            document.documentElement.hasAttribute('data-ds-page-transition')
        ).toBe(false);
    });
});
