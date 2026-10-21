import { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { lazyPage, preloadPages } from './index';

function Hello({ name }: { name: string }) {
    return <p>Hello {name}</p>;
}

describe('lazyPage', () => {
    it('renders through Suspense when the chunk has not arrived yet', async () => {
        const Page = lazyPage(() => Promise.resolve({ Hello }), 'Hello');

        render(
            <Suspense fallback={<p>loading</p>}>
                <Page name="there" />
            </Suspense>
        );

        expect(screen.getByText('loading')).toBeTruthy();
        expect(await screen.findByText('Hello there')).toBeTruthy();
    });

    it('never shows the fallback once preloaded', async () => {
        // The point of the helper: a plain `React.lazy` suspends on its first
        // render even with the module already fetched, which is a one-frame
        // flash of the route skeleton on every first visit.
        const Page = lazyPage(() => Promise.resolve({ Hello }), 'Hello');
        await act(() => Page.preload());

        render(
            <Suspense fallback={<p>loading</p>}>
                <Page name="again" />
            </Suspense>
        );

        expect(screen.queryByText('loading')).toBeNull();
        expect(screen.getByText('Hello again')).toBeTruthy();
    });

    it('fetches once however often it is preloaded', async () => {
        const factory = vi.fn(() => Promise.resolve({ Hello }));
        const Page = lazyPage(factory, 'Hello');

        await Promise.all([Page.preload(), Page.preload()]);
        await Page.preload();

        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('retries a chunk whose fetch failed', async () => {
        const factory = vi
            .fn<() => Promise<{ Hello: typeof Hello }>>()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({ Hello });
        const Page = lazyPage(factory, 'Hello');

        await expect(Page.preload()).rejects.toThrow('offline');
        await expect(Page.preload()).resolves.toBeTruthy();
        expect(factory).toHaveBeenCalledTimes(2);
    });

    it('is preloaded by preloadPages, which swallows a failing chunk', async () => {
        const failing = vi.fn(() => Promise.reject(new Error('gone')));
        const working = vi.fn(() => Promise.resolve({ Hello }));
        lazyPage(failing as () => Promise<{ Hello: typeof Hello }>, 'Hello');
        lazyPage(working, 'Hello');

        await expect(preloadPages()).resolves.toBeUndefined();
        expect(failing).toHaveBeenCalled();
        expect(working).toHaveBeenCalled();
    });
});
