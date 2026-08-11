import { createAdmin } from '@ortha-cms/bootstrap-admin';
import { IdentityPlugin } from '@ortha-cms/identity-admin';
import { ShellPlugin } from '@ortha-cms/shell-admin';
import { WorkspacesPlugin } from '@ortha-cms/workspaces-admin';
import { ContentPlugin } from '@ortha-cms/content-admin';
import { I18nPlugin } from '@ortha-cms/i18n-admin';
import { WysiwygPlugin } from '@ortha-cms/wysiwyg-admin';
import { MediaPlugin } from '@ortha-cms/media-admin';
import { InsightsPlugin } from '@ortha-cms/insights-admin';
import { UsersPlugin } from '@ortha-cms/users-admin';
import { ActivityPlugin } from '@ortha-cms/activity-admin';
import { ApiTokensPlugin } from '@ortha-cms/api-tokens-admin';
import { CopilotPlugin } from '@ortha-cms/copilot-admin';
import './styles.css';

createAdmin({
    plugins: [
        IdentityPlugin(),
        ShellPlugin(),
        WorkspacesPlugin(),
        // Insights goes first among the workspace-interior features: it
        // registers the dashboard's default sections, and section
        // contributions merge by id with the LAST one winning — so a plugin
        // that renames or reorders a band has to come after this. Its widget
        // slot is order-independent, so nothing else here is affected.
        InsightsPlugin(),
        // Workspace-interior features — they only contribute to the workspace
        // shell's rail/route slots, so they must follow WorkspacesPlugin().
        ContentPlugin(),
        // Contributes only to the Content Library's extension slots, so it
        // must follow ContentPlugin().
        I18nPlugin(),
        // Also a Content Library slot filler — it owns the control every
        // `richtext` field renders — so it likewise follows ContentPlugin().
        WysiwygPlugin(),
        MediaPlugin(),
        // Contributes nothing yet — phase 0 of the copilot registers the
        // plugin so the chat panel lands as a UI change, not a wiring one.
        // Belongs with the workspace-interior features: the panel will mount
        // into the workspace shell's sidebar footer.
        CopilotPlugin(),
        UsersPlugin(),
        ActivityPlugin(),
        // Global token-management page in the main sidebar (no workspace
        // context); backs the external content API.
        ApiTokensPlugin()
    ]
});
