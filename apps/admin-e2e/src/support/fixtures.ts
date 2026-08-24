import { test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { HomePage } from './pages/HomePage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { WorkspaceSettingsPage } from './pages/WorkspaceSettingsPage';
import { CreateWorkspacePage } from './pages/CreateWorkspacePage';
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
import { ApiTokensPage } from './pages/ApiTokensPage';
import { HostPage } from './pages/HostPage';

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
    apiTokensPage: ApiTokensPage;
    hostPage: HostPage;
    /**
     * Factory for a fresh axe scanner scoped to the current page, tagged
     * {@link AXE_TAGS} and with {@link AXE_KNOWN_GAPS} turned back off. Call it
     * per assertion so each scan reflects the page's current state.
     */
    makeAxe: () => AxeBuilder;
}

/**
 * `test` extended with page-object + accessibility fixtures — import this (not
 * `@playwright/test`) in specs, so a spec never constructs a page object itself.
 */
export const test = base.extend<Fixtures>({
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
    apiTokensPage: async ({ page }, use) => {
        await use(new ApiTokensPage(page));
    },
    hostPage: async ({ page }, use) => {
        await use(new HostPage(page));
    },
    makeAxe: async ({ page }, use) => {
        await use(() =>
            new AxeBuilder({ page })
                .withTags([...AXE_TAGS])
                .disableRules([...AXE_KNOWN_GAPS])
        );
    }
});

export { expect } from '@playwright/test';
