import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Activity Log at `/activity` (from
 * `@orthacms/activity-admin`).
 *
 * Data comes from the `GET /api/activity` mock (`mockActivity`); tests also
 * need `mockSignedIn` for the shell's auth probe. The page (and its nav entry)
 * gate on the signed-in user's `activity:read` permission.
 */
export class ActivityLogPage extends BasePage {
    /** The page's `<h1>`. */
    readonly heading: Locator;
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The Activity entry in the primary nav (an icon button, labelled). */
    readonly navButton: Locator;
    /** The free-text search box — people, records, actions. */
    readonly search: Locator;
    /** The time-range select ("Last 7 days"). */
    readonly rangeSelect: Locator;
    /** The day-grouped feed of event sentences (a named region). */
    readonly feed: Locator;
    /** "Export CSV", portalled into the top bar. */
    readonly exportButton: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Activity',
            level: 1
        });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
        this.navButton = this.nav.getByRole('button', { name: 'Activity' });
        this.search = page.getByRole('searchbox', {
            name: 'Search people, records, actions'
        });
        this.rangeSelect = page.getByRole('combobox', { name: 'Time range' });
        this.feed = page.getByRole('region', { name: 'Activity log' });
        this.exportButton = page.getByRole('button', { name: /Export CSV/ });
    }

    async goto() {
        await this.page.goto('/activity');
    }

    /**
     * Open the page with a query string — the URL is the source of truth for
     * every filter and page here, so deep links are a first-class entry point
     * (and the only way to reach a hand-edited, out-of-range param).
     */
    async gotoWith(search: string) {
        await this.page.goto(`/activity?${search}`);
    }

    /** The page's subtitle under the `<h1>` ("12 events in the last 7 days…"). */
    subtitle(): Locator {
        return this.page.getByText(
            /events? (in the last|today|across|match)|No events match/
        );
    }

    /** A feed row located by any visible text in its sentence. */
    row(text: string): Locator {
        return this.feed.getByRole('listitem').filter({ hasText: text });
    }

    /** The button that is a feed row — it opens the event panel. */
    rowButton(text: string): Locator {
        return this.row(text).getByRole('button').first();
    }

    /** Every row's text, in feed order (the sentence, workspace and time). */
    async sentences(): Promise<string[]> {
        return this.feed.getByRole('listitem').allInnerTexts();
    }

    /** A day heading in the feed ("Today", "Yesterday", a date). */
    dayHeading(name: string | RegExp): Locator {
        return this.feed.getByRole('heading', { level: 2, name });
    }

    /** Opens the event panel for the first row containing `text`. */
    async openEvent(text: string) {
        await this.rowButton(text).click();
        await this.eventPanel().waitFor();
    }

    /** The event panel — a non-modal dialog titled "Event". */
    eventPanel(): Locator {
        return this.page.getByRole('dialog', { name: 'Event' });
    }

    /** The panel's before/after table. */
    diffTable(): Locator {
        return this.eventPanel().getByRole('table', { name: 'What changed' });
    }

    /** The panel's folded "Raw metadata" disclosure. */
    rawMetadataToggle(): Locator {
        return this.eventPanel().getByRole('button', { name: 'Raw metadata' });
    }

    /** A link or button in the panel, by its accessible name. */
    panelAction(name: string | RegExp): Locator {
        return this.eventPanel()
            .getByRole('link', { name })
            .or(this.eventPanel().getByRole('button', { name }));
    }

    /** Pick a time range from the select. */
    async chooseRange(label: string) {
        await this.rangeSelect.click();
        await this.page.getByRole('option', { name: label }).click();
    }

    /** An applied-filter chip's remove button, by its condition label. */
    chipRemove(label: string): Locator {
        return this.page.getByRole('button', {
            name: `Remove condition ${label}`
        });
    }

    /** A filter chip by its text. */
    chip(text: string | RegExp): Locator {
        return this.page.locator('span[title]').filter({ hasText: text });
    }

    /** The feed loading skeleton — a `role="status"` region. */
    tableSkeleton(): Locator {
        return this.page
            .getByRole('status')
            .filter({ hasText: /Loading activity/ });
    }

    /** The no-access empty state heading (shown without `activity:read`). */
    noAccessText(): Locator {
        return this.page.getByText('You don’t have access to the activity log');
    }

    /** An empty-state heading, by its exact text. */
    emptyText(label: string): Locator {
        return this.page.getByText(label, { exact: true });
    }

    /** The "Clear filters" button inside the filtered empty state. */
    clearFilters(): Locator {
        return this.page.getByRole('button', { name: 'Clear filters' });
    }

    /**
     * The page's polite results live region — the sr-only `role="status"` that
     * tells AT what a filter or a page change did. Scoped away from the
     * skeleton's `role="status"`, which only exists while pending.
     */
    resultsStatus(): Locator {
        return this.page
            .getByRole('status')
            .filter({ hasText: /events? found/ });
    }

    /** The pagination button by its accessible name. */
    pageButton(name: 'Previous page' | 'Next page'): Locator {
        return this.page.getByRole('button', { name });
    }

    /** The error state's alert (distinct from the empty state). */
    errorAlert(): Locator {
        return this.page
            .getByRole('alert')
            .filter({ hasText: /Couldn’t load/ });
    }

    /**
     * The dead-letter banner — the "N actions were not recorded" warning above
     * the toolbar.
     *
     * Anchored on its title text rather than on `role="alert"` alone: the
     * page's own load-failure banner shares that role, and the two say opposite
     * things about whether the table below can be trusted.
     */
    deadLetterNotice(): Locator {
        return this.page
            .getByRole('alert')
            .filter({ hasText: /(was|were) not recorded/ });
    }

    /** The "Show all time" button inside the range empty state. */
    showAllTime(): Locator {
        return this.page.getByRole('button', { name: 'Show all time' });
    }

    /** The banner's button that opens the dead-letter dialog. */
    deadLettersTrigger(): Locator {
        return this.page.getByRole('button', { name: 'Review and retry' });
    }

    /**
     * The dead-letter dialog itself, named by its `DialogTitle` — the count
     * ("3 actions were not recorded"), or "Every action is recorded" once the
     * last one is queued.
     */
    deadLettersDialog(): Locator {
        return this.page.getByRole('dialog', {
            name: /not recorded|Every action is recorded/
        });
    }

    /** The dialog's list of parked events. */
    deadLettersList(): Locator {
        return this.deadLettersDialog().getByRole('list', {
            name: 'Events that could not be recorded'
        });
    }

    /** One parked event's row in the dialog, by any text in it. */
    deadLetterRow(text: string): Locator {
        return this.deadLettersList()
            .getByRole('listitem')
            .filter({ hasText: text });
    }

    /**
     * One row's Retry button, found by the row-scoped accessible name the
     * dialog gives it ("Retry {action} from {when}", the action as the log
     * labels it) — not by five identical "Retry"s, which is the point of the
     * name existing.
     */
    deadLetterRetry(label: string): Locator {
        return this.deadLettersDialog().getByRole('button', {
            name: new RegExp(`^Retry ${label} from `)
        });
    }

    /** The dialog's "Retry all" — named for how many rows it will send. */
    deadLettersRetryAll(): Locator {
        return this.deadLettersDialog().getByRole('button', {
            name: /^Retry (all \d+ events|the \d+ event) shown$/
        });
    }

    /** A row's "Queued" badge, once it has been retried. */
    deadLetterQueued(label: string): Locator {
        return this.deadLetterRow(label).getByText('Queued', { exact: true });
    }

    /** Every Retry button currently in the dialog. */
    deadLetterRetryButtons(): Locator {
        return this.deadLettersDialog().getByRole('button', {
            name: /^Retry .+ from /
        });
    }

    /** The dialog's own error state (distinct from its empty table). */
    deadLettersError(): Locator {
        return this.deadLettersDialog()
            .getByRole('alert')
            .filter({ hasText: /Couldn’t load the parked events/ });
    }

    /** The dialog's "Try again" button, inside that error state. */
    deadLettersReload(): Locator {
        return this.deadLettersDialog().getByRole('button', {
            name: 'Try again'
        });
    }

    /** The dialog's footer count ("Showing N events of M."), when capped. */
    deadLettersCount(): Locator {
        return this.deadLettersDialog().getByText(/^Showing /);
    }

    /**
     * Dismiss the dead-letter dialog with Escape.
     *
     * Escape rather than a click, because **two** controls in it are named
     * "Close" — the header's `DialogContent` X and the footer's button — so a
     * locator by name is a strict-mode violation rather than an action. Radix
     * closes on Escape and hands focus back through the notice's `triggerRef`,
     * which is the path a keyboard user takes anyway.
     */
    async closeDeadLettersDialog(): Promise<void> {
        await this.page.keyboard.press('Escape');
    }

    /**
     * Refetch what the page holds the way a returning tab does — the
     * background refresh nobody asked for.
     *
     * `visibilitychange` on **`window`** is the only event TanStack Query's
     * focus manager listens to (it dropped the `focus` listener in v5), so
     * dispatching anything else would silently do nothing and a test would pass
     * by never having refetched. No clock games are needed here, unlike the
     * session probe in `private-routes.spec.ts`: the dead-letter query takes
     * the default `staleTime` of 0, so it is stale the instant it resolves.
     */
    async refetchOnWindowFocus(): Promise<void> {
        await this.page.evaluate(() => {
            // Typed inline through `globalThis`: this project's tsconfig ships
            // no DOM lib.
            const browser = globalThis as unknown as {
                window: { dispatchEvent(event: unknown): void };
                Event: new (type: string) => unknown;
            };
            browser.window.dispatchEvent(new browser.Event('visibilitychange'));
        });
    }

    /**
     * The `aria-label` on every Retry button in the dialog, in row order.
     *
     * Read as attributes rather than as accessible names because the property
     * under test *is* the attribute: three buttons all reading "Retry" would
     * pass every naming rule axe has and still be useless to anyone listening
     * rather than looking.
     */
    async deadLetterRetryLabels(): Promise<string[]> {
        const buttons = this.deadLetterRetryButtons();
        const count = await buttons.count();
        const labels: string[] = [];
        for (let index = 0; index < count; index += 1) {
            labels.push(
                (await buttons.nth(index).getAttribute('aria-label')) ?? ''
            );
        }
        return labels;
    }

    /** Anything on the page claiming a sort state. Nothing here is sortable. */
    sortedCells(): Locator {
        return this.page.locator('[aria-sort]');
    }

    /** Whether focus currently sits inside the open dialog. */
    async focusIsInsideDialog(): Promise<boolean> {
        return this.page.evaluate(() => {
            const { document } = globalThis as unknown as {
                document: {
                    activeElement: unknown;
                    querySelector(
                        selector: string
                    ): { contains(node: unknown): boolean } | null;
                };
            };
            return (
                document
                    .querySelector('[role="dialog"]')
                    ?.contains(document.activeElement) ?? false
            );
        });
    }

    /** The id of whatever holds focus right now (`''` if it has none). */
    async focusedElementId(): Promise<string> {
        return this.page.evaluate(() => {
            const { document } = globalThis as unknown as {
                document: { activeElement: { id?: string } | null };
            };
            return document.activeElement?.id ?? '';
        });
    }

    /** A toast by its text — the retry's only announcement. */
    toast(text: string | RegExp): Locator {
        return this.page
            .locator('[data-sonner-toast]')
            .filter({ hasText: text });
    }
}
