import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Link, Route, Routes, BrowserRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    UnsavedChangesProvider,
    useUnsavedChanges,
    useUnsavedChangesApi
} from '.';

/** Stands in for the host's Radix confirm, with the same three-prop contract. */
function fakeDialog({
    open,
    onOpenChange,
    onConfirm
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}) {
    if (!open) return null;
    return (
        <div role="dialog">
            <button onClick={onConfirm}>Leave and discard</button>
            <button onClick={() => onOpenChange(false)}>Keep editing</button>
        </div>
    );
}

function Form({ dirty, formKey }: { dirty: boolean; formKey: string }) {
    useUnsavedChanges(dirty, formKey);
    return <span data-testid={`form-${formKey}`} />;
}

function Readout() {
    const api = useUnsavedChangesApi();
    return <span data-testid="isDirty">{String(api?.isDirty)}</span>;
}

function HistoryReadout() {
    return (
        <span data-testid="historyIdx">
            {String((window.history.state as { idx?: unknown } | null)?.idx)}
        </span>
    );
}

/**
 * A page with a dirty entry editor, plus a second form (the docked composer)
 * mounted outside the route tree so a route change does not unmount it.
 */
function App({ composerDirty = true }: { composerDirty?: boolean }) {
    const [entryDirty, setEntryDirty] = useState(true);
    return (
        <BrowserRouter>
            <UnsavedChangesProvider dialog={fakeDialog}>
                <Readout />
                <HistoryReadout />
                <Form dirty={composerDirty} formKey="composer" />
                <Routes>
                    <Route
                        path="/a"
                        element={
                            <div>
                                <span data-testid="page">a</span>
                                {entryDirty ? (
                                    <Form dirty formKey="entry" />
                                ) : null}
                                <button onClick={() => setEntryDirty(false)}>
                                    close entry
                                </button>
                                <Link to="/b">to b</Link>
                            </div>
                        }
                    />
                    <Route
                        path="/b"
                        element={
                            <div>
                                <span data-testid="page">b</span>
                                <Link to="/a">to a</Link>
                            </div>
                        }
                    />
                </Routes>
            </UnsavedChangesProvider>
        </BrowserRouter>
    );
}

function renderApp(props?: { composerDirty?: boolean }) {
    window.history.replaceState(null, '', '/a');
    return render(<App {...props} />);
}

afterEach(() => {
    window.history.replaceState(null, '', '/');
});

describe('UnsavedChangesProvider', () => {
    it('lets a link through untouched while nothing is dirty', () => {
        window.history.replaceState(null, '', '/a');
        render(<App composerDirty={false} />);
        act(() => {
            screen.getByText('close entry').click();
        });

        fireEvent.click(screen.getByText('to b'));
        expect(screen.getByTestId('page').textContent).toBe('b');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('holds an in-app link back and asks first', () => {
        renderApp();
        fireEvent.click(screen.getByText('to b'));

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByTestId('page').textContent).toBe('a');
    });

    it('stays put when the confirm is dismissed', () => {
        renderApp();
        fireEvent.click(screen.getByText('to b'));
        fireEvent.click(screen.getByText('Keep editing'));

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByTestId('page').textContent).toBe('a');
    });

    it('navigates once the user confirms', () => {
        renderApp();
        fireEvent.click(screen.getByText('to b'));
        fireEvent.click(screen.getByText('Leave and discard'));

        expect(screen.getByTestId('page').textContent).toBe('b');
        expect(window.location.pathname).toBe('/b');
    });

    // BUG-utils-admin-04 — the confirmed navigation used to be re-dispatched as
    // a raw `pushState({}, '', url)` plus a synthetic `popstate`, which wipes
    // the router's own history state. React Router then loses its index and
    // every later navigation writes a broken one, breaking Back/Forward deltas.
    it('leaves React Router its history index after a confirmed navigation [utils:I-17]', () => {
        // Only the entry form is dirty, so once it unmounts the follow-up
        // navigation is an ordinary one and its index can be compared.
        renderApp({ composerDirty: false });
        const before = (window.history.state as { idx?: number }).idx;
        expect(typeof before).toBe('number');

        fireEvent.click(screen.getByText('to b'));
        fireEvent.click(screen.getByText('Leave and discard'));

        const after = (window.history.state as { idx?: number } | null)?.idx;
        expect(typeof after).toBe('number');
        expect(Number.isNaN(after)).toBe(false);
        expect(after).toBe((before ?? 0) + 1);

        // And the next ordinary navigation still writes a usable index.
        fireEvent.click(screen.getByText('to a'));
        const next = (window.history.state as { idx?: number } | null)?.idx;
        expect(Number.isNaN(next)).toBe(false);
        expect(next).toBe((after ?? 0) + 1);
    });

    // BUG-utils-admin-03 — confirming one form's navigation used to clear the
    // whole dirty set, so a second still-mounted dirty form (the docked
    // composer, a dialog form) was silently disarmed for the rest of the
    // session and its edits could then be lost without a prompt.
    it('keeps the guard armed for a second form that is still dirty [utils:I-16]', () => {
        renderApp();
        fireEvent.click(screen.getByText('to b'));
        fireEvent.click(screen.getByText('Leave and discard'));

        expect(screen.getByTestId('page').textContent).toBe('b');
        expect(screen.getByTestId('isDirty').textContent).toBe('true');

        // The proof that matters: the next navigation still asks.
        fireEvent.click(screen.getByText('to a'));
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('disarms once the only dirty form unmounts', () => {
        renderApp({ composerDirty: false });
        expect(screen.getByTestId('isDirty').textContent).toBe('true');

        act(() => {
            screen.getByText('close entry').click();
        });
        expect(screen.getByTestId('isDirty').textContent).toBe('false');

        fireEvent.click(screen.getByText('to b'));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByTestId('page').textContent).toBe('b');
    });

    describe('clicks it deliberately leaves alone', () => {
        it.each([
            ['meta-click', { metaKey: true }],
            ['ctrl-click', { ctrlKey: true }],
            ['shift-click', { shiftKey: true }],
            ['alt-click', { altKey: true }],
            ['middle click', { button: 1 }]
        ])('%s opens elsewhere without prompting', (_name, init) => {
            renderApp();
            fireEvent.click(screen.getByText('to b'), init);
            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('a download link', () => {
            renderApp();
            const anchor = document.createElement('a');
            anchor.setAttribute('href', '/export.csv');
            anchor.setAttribute('download', '');
            document.body.append(anchor);

            fireEvent.click(anchor);
            expect(screen.queryByRole('dialog')).toBeNull();
            anchor.remove();
        });

        it('a target=_blank link', () => {
            renderApp();
            const anchor = document.createElement('a');
            anchor.setAttribute('href', '/elsewhere');
            anchor.setAttribute('target', '_blank');
            document.body.append(anchor);

            fireEvent.click(anchor);
            expect(screen.queryByRole('dialog')).toBeNull();
            anchor.remove();
        });

        it('an external origin, which beforeunload covers', () => {
            renderApp();
            const anchor = document.createElement('a');
            anchor.setAttribute('href', 'https://example.com/docs');
            document.body.append(anchor);

            fireEvent.click(anchor);
            expect(screen.queryByRole('dialog')).toBeNull();
            anchor.remove();
        });

        it('the skip link, so Bypass Blocks keeps working', () => {
            renderApp();
            const anchor = document.createElement('a');
            anchor.setAttribute('href', '#main-content');
            document.body.append(anchor);

            fireEvent.click(anchor);
            expect(screen.queryByRole('dialog')).toBeNull();
            anchor.remove();
        });

        it('a link to the URL we are already on', () => {
            renderApp();
            const anchor = document.createElement('a');
            anchor.setAttribute('href', '/a');
            document.body.append(anchor);

            fireEvent.click(anchor);
            expect(screen.queryByRole('dialog')).toBeNull();
            anchor.remove();
        });
    });

    describe('confirmNavigation', () => {
        function ProgrammaticProbe({ dirty }: { dirty: boolean }) {
            const api = useUnsavedChangesApi();
            useUnsavedChanges(dirty, 'probe');
            return (
                <button onClick={() => api?.confirmNavigation(proceed)}>
                    go
                </button>
            );
        }
        const proceed = vi.fn();

        afterEach(() => proceed.mockReset());

        it('runs straight through when nothing is dirty', () => {
            render(
                <BrowserRouter>
                    <UnsavedChangesProvider dialog={fakeDialog}>
                        <ProgrammaticProbe dirty={false} />
                    </UnsavedChangesProvider>
                </BrowserRouter>
            );
            fireEvent.click(screen.getByText('go'));
            expect(proceed).toHaveBeenCalledTimes(1);
        });

        it('waits for the confirm when a form is dirty', () => {
            render(
                <BrowserRouter>
                    <UnsavedChangesProvider dialog={fakeDialog}>
                        <ProgrammaticProbe dirty />
                    </UnsavedChangesProvider>
                </BrowserRouter>
            );
            fireEvent.click(screen.getByText('go'));
            expect(proceed).not.toHaveBeenCalled();

            fireEvent.click(screen.getByText('Leave and discard'));
            expect(proceed).toHaveBeenCalledTimes(1);
        });

        it('drops the navigation when the confirm is dismissed', () => {
            render(
                <BrowserRouter>
                    <UnsavedChangesProvider dialog={fakeDialog}>
                        <ProgrammaticProbe dirty />
                    </UnsavedChangesProvider>
                </BrowserRouter>
            );
            fireEvent.click(screen.getByText('go'));
            fireEvent.click(screen.getByText('Keep editing'));
            expect(proceed).not.toHaveBeenCalled();
        });
    });

    it('degrades to no guard outside a provider instead of throwing [utils:I-19]', () => {
        function Bare() {
            useUnsavedChanges(true, 'orphan');
            const api = useUnsavedChangesApi();
            return <span data-testid="api">{String(api)}</span>;
        }
        expect(() => render(<Bare />)).not.toThrow();
        expect(screen.getByTestId('api').textContent).toBe('null');
    });
});
