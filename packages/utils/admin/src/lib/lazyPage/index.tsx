import { lazy, type ComponentProps, type ComponentType, type JSX } from 'react';

/** Every page loader registered so far, in registration order. */
const loaders = new Set<() => Promise<unknown>>();

/** A code-split page that can be fetched ahead of its first render. */
export type LazyPage<T extends ComponentType<any>> = ((
    props: ComponentProps<T>
) => JSX.Element) & {
    /** Fetch the chunk now. Safe to call any number of times. */
    preload: () => Promise<unknown>;
};

/**
 * `React.lazy` for a route's page, with two differences that are the whole
 * point:
 *
 * - **Once the chunk has arrived, the page renders without suspending.** A
 *   plain `lazy` component suspends on its first render even when the module
 *   is already in the browser's cache, so a route that has been preloaded
 *   still flashes its `Suspense` skeleton for a frame. This one renders the
 *   loaded component directly as soon as it has it.
 * - **It registers itself for {@link preloadPages}**, which the host calls when
 *   the browser goes idle after boot. By the time someone clicks a nav item,
 *   its page is usually there — no skeleton, no wait.
 *
 * Takes the module's named export, so call sites stay one line:
 * `lazyPage(() => import('../pages/MembersPage'), 'MembersPage')`.
 */
export function lazyPage<
    M extends Record<K, ComponentType<any>>,
    K extends keyof M & string
>(factory: () => Promise<M>, exportName: K): LazyPage<M[K]> {
    type C = M[K];
    let loaded: C | undefined;
    let pending: Promise<{ default: C }> | undefined;

    const load = () =>
        (pending ??= factory().then(
            (module) => {
                loaded = module[exportName];
                return { default: loaded };
            },
            (error: unknown) => {
                // A failed fetch (offline, a redeploy that removed the hashed
                // chunk) must not be cached: the next attempt — a retry, or the
                // user clicking again — fetches afresh. `React.lazy` caches the
                // rejection on its own side; the app's error boundary owns that.
                pending = undefined;
                throw error;
            }
        ));

    const Lazy = lazy(load);

    function Page(props: ComponentProps<C>) {
        // `loaded` is set by the same promise `Lazy` waits on, and before React
        // retries the suspended render — so `Lazy` never commits a tree, and
        // swapping to `Component` here cannot remount anything.
        const Component = (loaded ?? Lazy) as ComponentType<ComponentProps<C>>;
        return <Component {...props} />;
    }

    loaders.add(load);
    return Object.assign(Page, { preload: load });
}

/**
 * Fetch every registered page chunk, one after another, swallowing failures
 * (a page that cannot load now will say so when it is actually opened).
 *
 * Sequential on purpose: these are background fetches, and firing two dozen at
 * once would compete with whatever the page the user is on still needs.
 */
export async function preloadPages(): Promise<void> {
    for (const load of loaders) {
        try {
            await load();
        } catch {
            // Reported, if it matters, on the real navigation.
        }
    }
}
