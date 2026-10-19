import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createPanelLayoutStore,
    PanelLayoutProvider,
    sanitizePanelLayout,
    usePanelLayoutEntry
} from '.';

/**
 * The panel layout store — the seams a browser test cannot attribute.
 *
 * A page test sees a panel at some width; it cannot tell a width the user just
 * chose from one the server's read put back a moment later, nor a corrupt cache
 * entry from an absent one. Those are the rules here: what a hydrate may and may
 * not overwrite, that only the user's own changes are announced for saving, and
 * that storage is never trusted.
 */

const KEY = 'test:panel-layout';

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('createPanelLayoutStore', () => {
    it('paints the first frame from the cache', () => {
        window.localStorage.setItem(
            KEY,
            JSON.stringify({ 'shell.sidebar': { width: 300 } })
        );
        expect(createPanelLayoutStore(KEY).getSnapshot()).toEqual({
            'shell.sidebar': { width: 300 }
        });
    });

    it('announces a user change, and only the panel it touched', () => {
        const store = createPanelLayoutStore(KEY);
        const onChange = vi.fn();
        store.onChange(onChange);

        store.update('shell.sidebar', { width: 300 });
        store.update('shell.sidebar', { collapsed: true });

        expect(onChange.mock.calls).toEqual([
            [{ 'shell.sidebar': { width: 300 } }],
            // The entry is announced whole, so a save replaces it whole.
            [{ 'shell.sidebar': { width: 300, collapsed: true } }]
        ]);
        expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({
            'shell.sidebar': { width: 300, collapsed: true }
        });
    });

    it('does not announce a change that changes nothing', () => {
        const store = createPanelLayoutStore(KEY);
        store.update('shell.sidebar', { width: 300 });
        const onChange = vi.fn();
        store.onChange(onChange);

        store.update('shell.sidebar', { width: 300 });

        expect(onChange).not.toHaveBeenCalled();
    });

    it('a hydrate is applied but never announced — saving what was just read would be an echo [design-system:I-47]', () => {
        const store = createPanelLayoutStore(KEY);
        const onChange = vi.fn();
        store.onChange(onChange);

        store.hydrate({ 'shell.sidebar': { width: 320 } });

        expect(store.getSnapshot()).toEqual({ 'shell.sidebar': { width: 320 } });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('a hydrate does not put back a panel the user changed since — the read is older [design-system:I-47]', () => {
        const store = createPanelLayoutStore(KEY);
        store.update('shell.sidebar', { width: 300 });

        store.hydrate({
            'shell.sidebar': { width: 220 },
            'shell.rightPanel': { collapsed: true }
        });

        expect(store.getSnapshot()).toEqual({
            'shell.sidebar': { width: 300 },
            'shell.rightPanel': { collapsed: true }
        });
    });

    it('survives storage that throws, in both directions', () => {
        const getItem = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new DOMException('The operation is insecure.');
            });
        const setItem = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new DOMException('QuotaExceededError');
            });
        try {
            const store = createPanelLayoutStore(KEY);
            expect(store.getSnapshot()).toEqual({});
            expect(() =>
                store.update('shell.sidebar', { width: 300 })
            ).not.toThrow();
            // Lost the cache, kept the layout.
            expect(store.getSnapshot()).toEqual({
                'shell.sidebar': { width: 300 }
            });
        } finally {
            getItem.mockRestore();
            setItem.mockRestore();
        }
    });

    it('survives a cache that is not JSON [design-system:I-47]', () => {
        window.localStorage.setItem(KEY, '{not json');
        expect(createPanelLayoutStore(KEY).getSnapshot()).toEqual({});
    });
});

describe('sanitizePanelLayout', () => {
    it('keeps well-formed entries and drops the rest, field by field', () => {
        expect(
            sanitizePanelLayout({
                good: { width: 300.4, collapsed: false },
                negative: { width: -10 },
                stringly: { width: '300', collapsed: 'yes' },
                halfGood: { width: Number.NaN, collapsed: true },
                notAnObject: 42,
                nothing: null
            })
        ).toEqual({
            good: { width: 300, collapsed: false },
            halfGood: { collapsed: true }
        });
    });

    it('answers {} for anything that is not a map', () => {
        expect(sanitizePanelLayout(null)).toEqual({});
        expect(sanitizePanelLayout([{ width: 300 }])).toEqual({});
        expect(sanitizePanelLayout('layout')).toEqual({});
    });
});

describe('usePanelLayoutEntry', () => {
    function Probe({ id }: { id: string }) {
        const [entry, update] = usePanelLayoutEntry(id);
        return (
            <button onClick={() => update({ width: (entry?.width ?? 0) + 10 })}>
                {id}:{entry?.width ?? 'none'}
            </button>
        );
    }

    it('two panels under one provider share one store', () => {
        render(
            <PanelLayoutProvider storageKey={KEY}>
                <Probe id="a.panel" />
                <Probe id="a.panel" />
            </PanelLayoutProvider>
        );

        act(() => screen.getAllByRole('button')[0].click());

        expect(
            screen.getAllByRole('button').map((b) => b.textContent)
        ).toEqual(['a.panel:10', 'a.panel:10']);
    });

    it('outside a provider, each panel keeps its own state — nothing leaks between mounts', () => {
        const first = render(<Probe id="a.panel" />);
        act(() => screen.getByRole('button').click());
        expect(screen.getByRole('button').textContent).toBe('a.panel:10');
        first.unmount();

        // A module-wide fallback would hand this mount the last one's width.
        render(<Probe id="a.panel" />);
        expect(screen.getByRole('button').textContent).toBe('a.panel:none');
    });
});
