import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Sparkles } from 'lucide-react';
import { Kbd } from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useWorkspaceIdFromRoute } from '../../application/useWorkspaceIdFromRoute';
import { CopilotPanel } from '../CopilotPanel';

// The product is called **Ortha AI**; the code, packages, routes, permission
// keys and tables all keep the `copilot` name. That mismatch is deliberate —
// see the naming note in `docs/design/copilot.md` — so don't "fix" the message
// ids to match the label.
const messages = defineMessages({
    open: {
        id: 'copilot.launcher.open',
        defaultMessage: 'Ortha AI'
    }
});

/** The permission the whole surface is gated on. */
const COPILOT_USE = 'copilot:use';

/**
 * The sidebar-footer entry point, and the panel it opens.
 *
 * Contributed to `SIDEBAR_FOOTER_SLOT`, so it is present across the global and
 * per-workspace sidebars — but it renders **nothing outside a workspace**, and
 * nothing for a user without `copilot:use`. Runs are workspace-scoped
 * (`X-Workspace-Id` is required by `WorkspaceGuard`), so offering the panel
 * where there is no open workspace would only produce a 400.
 *
 * The permission check mirrors the server's gate rather than replacing it: the
 * route enforces `copilot:use` regardless, and `useHasPermission` is
 * fail-closed, so a user whose permissions haven't loaded sees nothing rather
 * than a button that 403s.
 */
export function CopilotLauncher() {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const canUse = useHasPermission(COPILOT_USE);
    const workspaceId = useWorkspaceIdFromRoute();
    const available = canUse && !!workspaceId;

    // ⌘J / Ctrl+J toggles the panel (design §2). Registered only while the
    // launcher is actually available, so the shortcut can't open a panel the
    // user isn't allowed to use or that has no workspace to run against.
    useEffect(() => {
        if (!available) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'j') {
                return;
            }
            if (!event.metaKey && !event.ctrlKey) {
                return;
            }
            event.preventDefault();
            setOpen((current) => !current);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [available]);

    if (!available) {
        return null;
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
            >
                <Sparkles className="size-4 shrink-0" />
                <span className="flex-1 text-left">
                    {intl.formatMessage(messages.open)}
                </span>
                <Kbd className="hidden sm:inline-flex">⌘J</Kbd>
            </button>

            <CopilotPanel
                workspaceId={workspaceId}
                open={open}
                onOpenChange={setOpen}
            />
        </>
    );
}
