import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * How many element children a node has.
 *
 * Typed structurally rather than against the DOM: this project's tsconfig ships
 * no DOM lib (the specs drive a browser, they do not compile against one), which
 * is why `focus-and-title.spec.ts` reaches for `getComputedStyle` the same way.
 * Runs in the page, so it must stay self-contained.
 */
function childElementCountOf(node: unknown): number {
    return (node as { childElementCount: number }).childElementCount;
}

/**
 * Page object for the things `@ortha-cms/bootstrap-admin` mounts itself, as
 * opposed to anything a plugin contributes: the app-wide error boundary, the
 * route announcer, the toast host, and the bypass-blocks path into `<main>`.
 *
 * These have no page of their own — they are visible from every route — so they
 * get one page object rather than being smeared across the feature suites that
 * happen to trip over them.
 */
export class HostPage extends BasePage {
    /**
     * The app-wide error boundary's heading. Its `<h1>` (rather than bare text)
     * is what lets a screen-reader user find the failure by heading navigation.
     */
    readonly crashHeading: Locator;
    /** The boundary's only recovery affordance. */
    readonly crashReload: Locator;
    /**
     * The host's polite live region, announcing each new view after a
     * client-side navigation. Located by test id because it is deliberately
     * invisible (`sr-only`) and carries no accessible name of its own.
     */
    readonly routeAnnouncer: Locator;
    /**
     * The shell layout's "Skip to main content" link — the product's only
     * bypass-blocks mechanism (WCAG 2.4.1). Contributed by `shell-admin`, but
     * only present because the host mounted that plugin's `layout`.
     */
    readonly skipLink: Locator;
    /** The `<main>` landmark the skip link targets. */
    readonly main: Locator;
    /**
     * Sonner's toast list. It is created on the first toast, not at boot, so
     * assert against it only once a toast is visible. Its `data-{x,y}-position`
     * attributes are where the resolved corner is observable.
     */
    readonly toastHost: Locator;

    constructor(page: Page) {
        super(page);
        this.crashHeading = page.getByRole('heading', {
            name: 'Something went wrong'
        });
        this.crashReload = page.getByRole('button', {
            name: 'Reload the page'
        });
        this.routeAnnouncer = page.locator('[data-testid="route-announcer"]');
        this.skipLink = page.getByRole('link', {
            name: 'Skip to main content'
        });
        this.main = page.getByRole('main');
        this.toastHost = page.locator('[data-sonner-toaster]');
    }

    /**
     * Stands in for a lazily-loaded page whose chunk has vanished — the shape a
     * deploy takes for a tab that was already open, since chunk filenames are
     * content-hashed and the old ones stop existing. Any request carrying the
     * module's path is failed, which is what a stale hash amounts to.
     */
    async breakChunk(moduleName: string) {
        await this.page.route(`**/${moduleName}/**`, (route) => route.abort());
    }

    /**
     * How many elements React left under `#root`. Zero is the failure this
     * host's boundary exists to prevent: React unmounts the whole tree when a
     * throw reaches the root, leaving a blank document with nothing to focus and
     * no way back.
     */
    async rootChildCount(): Promise<number> {
        return this.page.locator('#root').evaluate(childElementCountOf);
    }
}
