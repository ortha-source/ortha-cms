import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppearanceProvider, THEME_STORAGE_KEY, useAppearance } from '.';

/**
 * QA ORT-49 · F2, EC-22, EC-27, EC-29, EC-30 — the theme provider.
 *
 * Everything visual in the admin keys off the `dark` class this provider puts
 * on `<html>`, and the storage round trip is what stops a light flash on every
 * reload. Reachable only through the account menu in a browser; pinned here.
 */
type Listener = (event: MediaQueryListEvent) => void;

const listeners = new Set<Listener>();

function mockScheme(prefersDark: boolean) {
    listeners.clear();
    window.matchMedia = ((query: string) => ({
        matches: prefersDark && query.includes('dark'),
        media: query,
        onchange: null,
        addEventListener: (_: string, fn: Listener) => listeners.add(fn),
        removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    })) as typeof window.matchMedia;
}

function Probe() {
    const { theme, resolvedTheme, setTheme } = useAppearance();
    return (
        <div>
            <span data-testid="theme">{theme}</span>
            <span data-testid="resolved">{resolvedTheme}</span>
            <button onClick={() => setTheme('dark')}>dark</button>
            <button onClick={() => setTheme('system')}>system</button>
        </div>
    );
}

const theme = () => screen.getByTestId('theme').textContent;
const resolved = () => screen.getByTestId('resolved').textContent;

beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
    mockScheme(false);
});

afterEach(() => window.localStorage.clear());

describe('AppearanceProvider', () => {
    it('defaults to the system preference', () => {
        render(
            <AppearanceProvider>
                <Probe />
            </AppearanceProvider>
        );
        expect(theme()).toBe('system');
        expect(resolved()).toBe('light');
    });

    it('reflects a chosen theme onto <html>', () => {
        render(
            <AppearanceProvider>
                <Probe />
            </AppearanceProvider>
        );

        act(() => screen.getByText('dark').click());

        expect(resolved()).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('hydrates synchronously from storage, so the first paint already matches', () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

        const { container } = render(
            <AppearanceProvider>
                <Probe />
            </AppearanceProvider>
        );

        expect(container.textContent).toContain('dark');
    });

    it('falls back to system for a corrupt stored value', () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, 'banana');

        render(
            <AppearanceProvider>
                <Probe />
            </AppearanceProvider>
        );

        expect(theme()).toBe('system');
    });

    it('persists the choice', () => {
        render(
            <AppearanceProvider>
                <Probe />
            </AppearanceProvider>
        );
        act(() => screen.getByText('dark').click());

        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('follows the OS while the preference is system', () => {
        render(
            <AppearanceProvider>
                <Probe />
            </AppearanceProvider>
        );
        expect(resolved()).toBe('light');

        act(() => {
            for (const fn of listeners) {
                fn({ matches: true } as MediaQueryListEvent);
            }
        });

        expect(resolved()).toBe('dark');
    });

    // EC-27 — private mode / quota.
    it('renders and still repaints when storage throws', () => {
        const getItem = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('SecurityError');
            });
        const setItem = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

        try {
            render(
                <AppearanceProvider>
                    <Probe />
                </AppearanceProvider>
            );
            act(() => screen.getByText('dark').click());
            expect(document.documentElement.classList.contains('dark')).toBe(
                true
            );
        } finally {
            getItem.mockRestore();
            setItem.mockRestore();
        }
    });

    // EC-30 — idempotent by construction.
    it('removes the dark class again on the way back to light', () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        const { unmount } = render(
            <AppearanceProvider>
                <Probe />
            </AppearanceProvider>
        );
        expect(document.documentElement.classList.contains('dark')).toBe(true);

        act(() => screen.getByText('system').click());
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        unmount();
    });
});

describe('useAppearance', () => {
    it('falls back to a working no-op outside a provider', () => {
        render(<Probe />);

        expect(theme()).toBe('system');
        expect(resolved()).toBe('light');
        expect(() => act(() => screen.getByText('dark').click())).not.toThrow();
    });
});
