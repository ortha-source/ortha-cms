import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Page object for the home page at `/` (the post-login landing). */
export class HomePage extends BasePage {
    /**
     * The page's `<h1>` — the time-of-day greeting (`Good …, {email}`). Matched
     * by level rather than text, since the greeting varies by hour and user.
     */
    readonly heading: Locator;
    /**
     * The authenticated shell's primary nav (from `@orthacms/shell-admin`'s
     * `AppShell` toolbar). Present only when a private route renders inside the
     * shell, so it doubles as proof the gated layout wrapped the page.
     */
    readonly nav: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', { level: 1 });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
    }

    async goto() {
        await this.page.goto('/');
    }

    /**
     * A dashboard stat tile's label (proof the tile rendered). Scoped to the
     * main content region so it never matches a same-named sidebar nav item
     * (e.g. "Members").
     */
    statTile(label: string): Locator {
        return this.page.getByRole('main').getByText(label, { exact: true });
    }

    /** The Workspaces dashboard panel heading (`<h2>`). */
    get workspacesPanel(): Locator {
        return this.page.getByRole('main').getByRole('heading', {
            name: 'Workspaces',
            level: 2
        });
    }

    /** The Recent activity dashboard panel heading (`<h2>`). */
    get activityPanel(): Locator {
        return this.page.getByRole('main').getByRole('heading', {
            name: 'Recent activity',
            level: 2
        });
    }

    /**
     * "Needs your attention" — the region of cards plugins render only while
     * something is stuck. Hidden (heading included) while none is.
     */
    get attention(): Locator {
        return this.page.getByRole('region', { name: 'Needs your attention' });
    }

    /** An attention card — each is one link, named by its title. */
    attentionCard(title: RegExp | string): Locator {
        return this.attention.getByRole('link', { name: title });
    }

    /**
     * A create action in the top bar. Scoped to `<main>`: the sidebar's
     * Workspaces group carries its own "New workspace" icon link.
     */
    topBarAction(name: string): Locator {
        return this.page.getByRole('main').getByRole('link', { name });
    }

    /**
     * The branded root loader (`AppLoader`) — a `role="status"` region shown
     * while the auth probe (`GET /api/auth/me`) is still resolving, before the
     * gated shell renders. Seed it with `mockSignedIn(page, {}, { delayMs })`.
     */
    rootLoader(): Locator {
        return this.page.getByRole('status').filter({ hasText: /Loading/ });
    }

    /**
     * The gate's outage screen (`AuthUnavailable`), shown when the auth probe
     * fails for a reason other than `401`. Seed it with
     * `mockAuthProbeUnavailable(page)`.
     */
    authUnavailableHeading(): Locator {
        return this.page.getByRole('heading', {
            name: 'We can’t reach the server'
        });
    }

    /** The outage screen's retry control. */
    retryAuthProbe(): Locator {
        return this.page.getByRole('button', { name: 'Try again' });
    }
}
