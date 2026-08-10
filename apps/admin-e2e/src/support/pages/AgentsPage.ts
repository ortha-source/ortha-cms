import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the **Agents view** (`@ortha-cms/copilot-admin`) — the
 * full-page chat at `/workspaces/:id/agents`, its thread rail, the composer, and
 * the sidebar's CMS ⇄ Agents switcher. Seed it with `mockSignedIn`,
 * `mockWorkspaces` and `mockCopilotApi`.
 *
 * Two scoping rules are load-bearing and are why almost everything below hangs
 * off a region rather than off `page`:
 *
 * - **The docked panel renders the same composer, transcript and model picker.**
 *   The dock is portalled to `<body>`, and the page's own column is inside the
 *   shell's `<main>` — so the thread handles are scoped to `main` and can never
 *   accidentally drive a floating window that happens to be open.
 * - **"New chat" and "Chats" each name two controls.** The rail has a New chat
 *   button and the dock has one; the rail is an `aside` labelled "Chats" wrapping
 *   a `nav` with the same name. Scoping to {@link rail} / {@link dock} keeps each
 *   handle pointing at one thing.
 */
export class AgentsPage extends BasePage {
    /** The shell's inset — everything the *page* renders, and nothing portalled. */
    readonly main: Locator;
    /** The thread column (md+). Below that the same list lives in a sheet. */
    readonly rail: Locator;
    /** The bottom-right bar of chats the dock owns. */
    readonly dock: Locator;

    constructor(page: Page) {
        super(page);
        this.main = page.getByRole('main');
        this.rail = page.getByRole('complementary', { name: 'Chats' });
        this.dock = page.getByRole('toolbar', { name: 'Ortha AI chats' });
    }

    // --- navigation -------------------------------------------------------

    /** An unsaved new chat: `/workspaces/:id/agents`. */
    async goto(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/agents`);
    }

    /** One saved thread: `/workspaces/:id/agents/:conversationId`. */
    async gotoThread(workspaceId: string, conversationId: string) {
        await this.page.goto(
            `/workspaces/${workspaceId}/agents/${conversationId}`
        );
    }

    // --- the sidebar's CMS ⇄ Agents switcher ------------------------------

    /** The two-segment control at the top of the workspace sidebar. */
    viewSwitcher(): Locator {
        return this.page.getByRole('radiogroup', { name: 'View' });
    }

    /** One half of the switcher. Radix renders each segment as a radio. */
    viewTab(name: 'CMS' | 'Agents'): Locator {
        return this.viewSwitcher().getByRole('radio', { name });
    }

    /** Switch modes. Going back to CMS returns to the page you left. */
    async switchView(name: 'CMS' | 'Agents') {
        await this.viewTab(name).click();
    }

    // --- the top bar ------------------------------------------------------

    /** The breadcrumb's leaf — the open thread's title, or "New chat". */
    breadcrumbLeaf(): Locator {
        return this.main
            .getByRole('navigation', { name: 'Breadcrumb' })
            .getByRole('listitem')
            .last();
    }

    // --- the rail ---------------------------------------------------------

    /** Starts an unsaved chat. Scoped to the rail — the dock has one too. */
    railNewChat(): Locator {
        return this.rail.getByRole('button', { name: 'New chat' });
    }

    /** The filter. Only rendered past five threads. */
    railFilter(): Locator {
        return this.rail.getByRole('searchbox', { name: 'Search chats' });
    }

    /** Type into the filter. */
    async filterChats(query: string) {
        await this.railFilter().fill(query);
    }

    /** One thread's row, by the title it shows. */
    railRow(title: string): Locator {
        return this.rail.getByRole('button', { name: title, exact: true });
    }

    /** Every thread row currently listed, in rail order. */
    railRows(): Locator {
        return this.rail.getByRole('listitem');
    }

    /** A recency heading ("Today", "Previous 7 days", …). */
    railGroup(name: string): Locator {
        return this.rail.getByRole('heading', { name });
    }

    /** Every recency heading on screen, in order — for grouping assertions. */
    async railGroupNames(): Promise<string[]> {
        return this.rail.getByRole('heading').allInnerTexts();
    }

    /** The rail's "couldn't load your chats" state — distinct from empty. */
    railError(): Locator {
        return this.rail.getByRole('alert');
    }

    /** Its retry control. */
    railRetry(): Locator {
        return this.railError().getByRole('button', { name: 'Try again' });
    }

    /** The rail's empty / no-matches line, whichever is showing. */
    railMessage(text: string | RegExp): Locator {
        return this.rail.getByText(text);
    }

    /** The footer link into the archive. Absent while nothing is archived. */
    archivedLink(): Locator {
        return this.rail.getByRole('button', { name: /^Archived/ });
    }

    /** The way out of the archive (it replaces New chat while in it). */
    backToChats(): Locator {
        return this.rail.getByRole('button', { name: 'Back to chats' });
    }

    // --- a row's ⋯ menu ---------------------------------------------------

    /** A row's actions trigger. Named after the chat, not a bare "More". */
    rowMenuTrigger(title: string): Locator {
        return this.rail.getByRole('button', { name: `Actions for ${title}` });
    }

    /** Open a row's ⋯ menu. */
    async openRowMenu(title: string) {
        await this.rowMenuTrigger(title).click();
    }

    /** An item in the open row menu. */
    rowMenuItem(name: 'Rename…' | 'Archive' | 'Unarchive'): Locator {
        return this.page.getByRole('menuitem', { name });
    }

    /** Open a row's menu and pick one of its actions. */
    async chooseRowAction(
        title: string,
        action: 'Rename…' | 'Archive' | 'Unarchive'
    ) {
        await this.openRowMenu(title);
        await this.rowMenuItem(action).click();
    }

    // --- the rename dialog ------------------------------------------------

    /** The rename dialog. */
    renameDialog(): Locator {
        return this.page.getByRole('dialog', { name: 'Rename chat' });
    }

    /** Its one field. */
    renameInput(): Locator {
        return this.renameDialog().getByLabel('Chat name');
    }

    /** Its Save control — disabled only while saving, never on a bad value. */
    renameSave(): Locator {
        return this.renameDialog().getByRole('button', { name: 'Save' });
    }

    /** Its Cancel control. */
    renameCancel(): Locator {
        return this.renameDialog().getByRole('button', { name: 'Cancel' });
    }

    /** A validation or failure message inside the dialog. */
    renameError(text: string | RegExp): Locator {
        return this.renameDialog().getByText(text);
    }

    /** Rename a thread end to end. */
    async renameChat(title: string, next: string) {
        await this.chooseRowAction(title, 'Rename…');
        await this.renameInput().fill(next);
        await this.renameSave().click();
    }

    // --- the thread -------------------------------------------------------

    /** The transcript region. Absent until the thread has a turn in it. */
    transcript(): Locator {
        return this.main.getByRole('log', { name: 'Conversation' });
    }

    /**
     * The transcript's rendered text, top to bottom.
     *
     * The handle **ordering** assertions use: a turn is prose, tool steps and
     * change cards interleaved in the order the run produced them, and the bug
     * worth guarding is a card rendering below the sentence written after it.
     * Comparing `indexOf` of two fragments says that in one line, and needs no
     * selector for a layout wrapper that carries no semantics.
     */
    async transcriptText(): Promise<string> {
        return this.transcript().innerText();
    }

    /** The empty thread's greeting. */
    welcomeHeading(): Locator {
        return this.main.getByRole('heading', {
            name: /What can I help you with/
        });
    }

    /** One of the empty state's four openers. */
    suggestion(text: string | RegExp): Locator {
        return this.main.getByRole('button', { name: text });
    }

    /** The "could not open this chat" state. */
    threadError(): Locator {
        return this.main.getByRole('alert').filter({
            hasText: 'Could not open this chat'
        });
    }

    /** Its retry control. */
    threadRetry(): Locator {
        return this.threadError().getByRole('button', { name: 'Try again' });
    }

    /** One tool step's collapsed line, e.g. /Updated an entry/. */
    toolStep(label: string | RegExp): Locator {
        return this.main.getByRole('button', { name: label });
    }

    /** A change card, named by its own summary. */
    proposalCard(summary: string | RegExp): Locator {
        return this.main.getByRole('region', { name: summary });
    }

    // --- the composer -----------------------------------------------------

    /** The message box. */
    composer(): Locator {
        return this.main.getByRole('textbox', {
            name: 'Ask about your content…'
        });
    }

    /** Send — becomes Stop while a run is in flight. */
    sendButton(): Locator {
        return this.main.getByRole('button', { name: 'Send' });
    }

    /** Stop, i.e. the same button mid-run. */
    stopButton(): Locator {
        return this.main.getByRole('button', { name: 'Stop' });
    }

    /** Type a turn and send it with Enter, the way a user does. */
    async ask(text: string) {
        await this.composer().fill(text);
        await this.composer().press('Enter');
    }

    /** The composer's measured height, for the auto-grow assertions. */
    async composerHeight(): Promise<number> {
        const box = await this.composer().boundingBox();
        return box?.height ?? 0;
    }

    // --- the model picker (bottom-left of the composer) --------------------

    /** The picker's trigger. It shows the current choice, or "Default". */
    modelPicker(): Locator {
        return this.main.getByRole('button', { name: 'Choose a model' });
    }

    /** Pick a backend by its model id (the item also names its provider). */
    async chooseModel(model: string) {
        await this.modelPicker().click();
        await this.page
            .getByRole('menuitem', { name: new RegExp(model) })
            .click();
    }

    // --- the dock ---------------------------------------------------------

    /** A chat's pill. Its name carries the marker ("— finished"). */
    dockPill(name: string | RegExp): Locator {
        return this.dock.getByRole('button', { name });
    }

    // --- toasts -----------------------------------------------------------

    /** A toast by its message. */
    toast(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }
}
