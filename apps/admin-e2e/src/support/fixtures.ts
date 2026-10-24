import { test as base, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { HomePage } from './pages/HomePage';
import { ResizablePanelsPage } from './pages/ResizablePanelsPage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { WorkspaceSettingsPage } from './pages/WorkspaceSettingsPage';
import { CreateWorkspacePage } from './pages/CreateWorkspacePage';
import { WorkspaceReadyPage } from './pages/WorkspaceReadyPage';
import { MembersPage } from './pages/MembersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { ContentLibraryPage } from './pages/ContentLibraryPage';
import { SavedViewsPage } from './pages/SavedViewsPage';
import { RelationsEditorPage } from './pages/RelationsEditorPage';
import { MediaLibraryPage } from './pages/MediaLibraryPage';
import { MediaFieldPage } from './pages/MediaFieldPage';
import { WysiwygFieldPage } from './pages/WysiwygFieldPage';
import { AgentsPage } from './pages/AgentsPage';
import { CopilotDockPage } from './pages/CopilotDockPage';
import { CopilotSkillsPage } from './pages/CopilotSkillsPage';
import { InsightsPage } from './pages/InsightsPage';
import { AlarmsPage } from './pages/AlarmsPage';
import { SegmentsPage } from './pages/SegmentsPage';
import { ApiTokensPage } from './pages/ApiTokensPage';
import { WebhooksPage } from './pages/WebhooksPage';
import { ContentModelPage } from './pages/ContentModelPage';
import { HostPage } from './pages/HostPage';
import { TransferPage } from './pages/TransferPage';

/**
 * The tag whitelist every scan runs under.
 *
 * `withTags` is a **whitelist**, not a filter over everything axe knows: a rule
 * carrying none of these tags never executes. The four WCAG tags alone left
 * roughly a third of axe's catalogue switched off — including the entire
 * `best-practice` family, which is where axe files the structural rules
 * (`heading-order`, `page-has-heading-one`, `region`, the `landmark-*` set,
 * `tabindex`, `skip-link`, `aria-dialog-name`). The suite therefore could not
 * see heading structure or landmark structure at all, and said so nowhere: no
 * rule had been *disabled*, so both `AGENTS.md` and the skill could truthfully
 * claim "no rule exclusions" while a third of the catalogue never ran.
 *
 * `best-practice` is now on, which is what makes {@link AXE_KNOWN_GAPS} an
 * honest, reviewable list instead of an invisible hole.
 */
export const AXE_TAGS = [
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'best-practice'
] as const;

/**
 * The rules turned back off, and why.
 *
 * Switching `best-practice` on uncovered five findings. **Four are fixed** and
 * their rules are live again, guarding against regression:
 *
 * - `landmark-one-main` (was 14 nodes) — the signed-out shell rendered no
 *   `<main>` at all. `ORT-166`
 * - `page-has-heading-one` (11) — the Agents view, the Content Library panes and
 *   three busy states rendered no `<h1>`. `ORT-167`
 * - `heading-order` (6) — `AlertTitle` was a hard-coded `<h5>` under every
 *   page's `<h1>`. `ORT-168`
 * - `aria-dialog-name` (2) — the column picker and the people search announced
 *   a bare "dialog". `ORT-169`
 *
 * `region` (49) is the one that stays off, and the reason is the rule rather
 * than the product. Its two real findings **are** fixed — the app sidebar and
 * the copilot dock are named landmarks now (`ORT-170`) — and what is left is a
 * class axe cannot currently be told about: an **open Radix menu**, portalled to
 * `<body>` as `div[data-radix-popper-content-wrapper]`. axe's own default
 * exempts transient overlays, via a `regionMatcher` of
 * `'dialog, [role=dialog], [role=alertdialog], svg'` — which is why the Content
 * Library's column picker (a Popover, so `role="dialog"`) passes and the
 * identical row menu beside it does not. `[role=menu]` simply is not on that
 * list, and `regionMatcher` is a **check** option: `AxeBuilder` can only pass
 * `RunOptions`, which carries no way to set one.
 *
 * The alternative — `.exclude()`-ing the wrapper — would drop the menu's whole
 * subtree from *every* rule, losing the contrast and naming checks that
 * currently run inside it. That is a worse trade than one disabled
 * best-practice rule.
 *
 * So the guard `region` was providing is replaced by something sharper rather
 * than dropped: `host/host.spec.ts` asserts by name that the sidebar and the
 * dock are landmarks, which is what it actually caught.
 *
 * **Deleting an entry here is the last step of a fix**, and
 * `harness/axe-fixture.spec.ts` pins this list so it cannot quietly grow.
 */
export const AXE_KNOWN_GAPS: readonly string[] = ['region'];

interface Fixtures {
    loginPage: LoginPage;
    acceptInvitePage: AcceptInvitePage;
    resetPasswordPage: ResetPasswordPage;
    homePage: HomePage;
    workspacesPage: WorkspacesPage;
    workspaceSettingsPage: WorkspaceSettingsPage;
    createWorkspacePage: CreateWorkspacePage;
    workspaceReadyPage: WorkspaceReadyPage;
    membersPage: MembersPage;
    userDetailPage: UserDetailPage;
    activityLogPage: ActivityLogPage;
    contentLibraryPage: ContentLibraryPage;
    savedViewsPage: SavedViewsPage;
    relationsEditorPage: RelationsEditorPage;
    mediaLibraryPage: MediaLibraryPage;
    mediaFieldPage: MediaFieldPage;
    wysiwygFieldPage: WysiwygFieldPage;
    agentsPage: AgentsPage;
    copilotDockPage: CopilotDockPage;
    copilotSkillsPage: CopilotSkillsPage;
    insightsPage: InsightsPage;
    alarmsPage: AlarmsPage;
    segmentsPage: SegmentsPage;
    apiTokensPage: ApiTokensPage;
    webhooksPage: WebhooksPage;
    contentModelPage: ContentModelPage;
    hostPage: HostPage;
    resizablePanels: ResizablePanelsPage;
    transferPage: TransferPage;
    /**
     * Factory for a fresh axe scanner scoped to the current page, tagged
     * {@link AXE_TAGS} and with {@link AXE_KNOWN_GAPS} turned back off. Call it
     * per assertion so each scan reflects the page's current state.
     */
    makeAxe: () => AxeBuilder;
}

/**
 * Resolves once every **finite** animation on the page has finished (or after
 * two seconds, whichever is first). Infinite ones — a spinner, a skeleton's
 * pulse — never finish and are not waited for.
 *
 * axe reads computed styles, and the admin's entrances fade content in: a
 * scan that lands mid-fade measures text at partial opacity and reports a
 * contrast failure that no reader ever sees. Waiting the ~200ms out is the
 * honest fix; turning motion off for the scan would hide a real problem the
 * day an entrance leaves something stuck transparent.
 *
 * Runs in the page, so it is self-contained — no closure over this file.
 */
async function settleAnimations(page: Page): Promise<void> {
    await page.evaluate(async () => {
        type Running = {
            playState: string;
            finished: Promise<unknown>;
            effect: { getTiming(): { iterations?: number } } | null;
        };
        const doc = (
            globalThis as unknown as {
                document: { getAnimations?: () => Running[] };
            }
        ).document;
        const finite = (doc.getAnimations?.() ?? []).filter(
            (animation) =>
                animation.playState === 'running' &&
                animation.effect?.getTiming().iterations !== Infinity
        );
        await Promise.race([
            Promise.allSettled(finite.map((animation) => animation.finished)),
            new Promise((resolve) => setTimeout(resolve, 2000))
        ]);
    });
}

/** An {@link AxeBuilder} that lets the page's entrances finish before it scans. */
class SettledAxeBuilder extends AxeBuilder {
    constructor(private readonly target: Page) {
        super({ page: target });
    }

    override async analyze() {
        await settleAnimations(this.target);
        return super.analyze();
    }
}

/**
 * `test` extended with page-object + accessibility fixtures — import this (not
 * `@playwright/test`) in specs, so a spec never constructs a page object itself.
 */
/**
 * Where the shell keeps the reader's pin of the right panel
 * (`RIGHT_PANEL_PIN_KEY` in shell-admin — duplicated, since specs never import
 * app source).
 */
export const RIGHT_PANEL_PIN_KEY = 'orthacms:right-panel:pinned';

export const test = base.extend<Fixtures>({
    // Every suite starts with the entry editor's Properties **pinned** as a
    // docked column — the layout the rail's specs were written against. Since
    // ADR-0022 it opens over the form on demand by default; the specs about
    // that overlay unpin it themselves (`contentLibraryPage.unpinProperties`).
    page: async ({ page }, use) => {
        await page.addInitScript((key) => {
            try {
                (
                    globalThis as unknown as {
                        localStorage: { setItem(k: string, v: string): void };
                    }
                ).localStorage.setItem(key, 'true');
            } catch {
                // An opaque origin (about:blank) has no storage; the app's
                // own origin does.
            }
        }, RIGHT_PANEL_PIN_KEY);
        await use(page);
    },
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    acceptInvitePage: async ({ page }, use) => {
        await use(new AcceptInvitePage(page));
    },
    resetPasswordPage: async ({ page }, use) => {
        await use(new ResetPasswordPage(page));
    },
    homePage: async ({ page }, use) => {
        await use(new HomePage(page));
    },
    workspacesPage: async ({ page }, use) => {
        await use(new WorkspacesPage(page));
    },
    workspaceSettingsPage: async ({ page }, use) => {
        await use(new WorkspaceSettingsPage(page));
    },
    workspaceReadyPage: async ({ page }, use) => {
        await use(new WorkspaceReadyPage(page));
    },
    createWorkspacePage: async ({ page }, use) => {
        await use(new CreateWorkspacePage(page));
    },
    membersPage: async ({ page }, use) => {
        await use(new MembersPage(page));
    },
    userDetailPage: async ({ page }, use) => {
        await use(new UserDetailPage(page));
    },
    activityLogPage: async ({ page }, use) => {
        await use(new ActivityLogPage(page));
    },
    contentLibraryPage: async ({ page }, use) => {
        await use(new ContentLibraryPage(page));
    },
    savedViewsPage: async ({ page }, use) => {
        await use(new SavedViewsPage(page));
    },
    relationsEditorPage: async ({ page }, use) => {
        await use(new RelationsEditorPage(page));
    },
    mediaLibraryPage: async ({ page }, use) => {
        await use(new MediaLibraryPage(page));
    },
    mediaFieldPage: async ({ page }, use) => {
        await use(new MediaFieldPage(page));
    },
    wysiwygFieldPage: async ({ page }, use) => {
        await use(new WysiwygFieldPage(page));
    },
    agentsPage: async ({ page }, use) => {
        await use(new AgentsPage(page));
    },
    copilotDockPage: async ({ page }, use) => {
        await use(new CopilotDockPage(page));
    },
    copilotSkillsPage: async ({ page }, use) => {
        await use(new CopilotSkillsPage(page));
    },
    insightsPage: async ({ page }, use) => {
        await use(new InsightsPage(page));
    },
    segmentsPage: async ({ page }, use) => {
        await use(new SegmentsPage(page));
    },
    alarmsPage: async ({ page }, use) => {
        await use(new AlarmsPage(page));
    },
    apiTokensPage: async ({ page }, use) => {
        await use(new ApiTokensPage(page));
    },
    webhooksPage: async ({ page }, use) => {
        await use(new WebhooksPage(page));
    },
    contentModelPage: async ({ page }, use) => {
        await use(new ContentModelPage(page));
    },
    hostPage: async ({ page }, use) => {
        await use(new HostPage(page));
    },
    resizablePanels: async ({ page }, use) => {
        await use(new ResizablePanelsPage(page));
    },
    transferPage: async ({ page }, use) => {
        await use(new TransferPage(page));
    },
    makeAxe: async ({ page }, use) => {
        await use(() =>
            new SettledAxeBuilder(page)
                .withTags([...AXE_TAGS])
                .disableRules([...AXE_KNOWN_GAPS])
        );
    }
});

export { expect } from '@playwright/test';
