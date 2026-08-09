import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Sparkles } from 'lucide-react';
import { Kbd } from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useCopilotSessions } from '../../application/useCopilotSessions';
import { useRouteContext } from '../../application/useRouteContext';
import { CopilotDock } from '../CopilotDock';
import { CopilotSession } from '../CopilotSession';

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
 * The entry points, the chats they start, and the dock that lists them.
 *
 * Contributed to `SIDEBAR_FOOTER_SLOT`, so it is present across the global and
 * per-workspace sidebars — but it renders **nothing outside a workspace**, and
 * nothing for a user without `copilot:use`. Runs are workspace-scoped
 * (`X-Workspace-Id` is required by `WorkspaceGuard`), so offering a chat where
 * there is no open workspace would only produce a 400.
 *
 * **There is no floating button any more.** It could only ever mean "the
 * panel", singular. The dock replaces it: with no chats open it *is* a labelled
 * Ortha AI button in the same corner, and as soon as there are chats it becomes
 * the bar listing them. One control that grows into the thing it opens, rather
 * than a button and a separate list that both mean roughly the same.
 *
 * **Every chat stays mounted for as long as its pill exists**, collapsed or
 * not. That is what lets three answers stream while you read a fourth, and it
 * is why closing a pill — not collapsing it — is the thing that cancels a run.
 *
 * The permission check mirrors the server's gate rather than replacing it: the
 * route enforces `copilot:use` regardless, and `useHasPermission` is
 * fail-closed, so a user whose permissions haven't loaded sees nothing rather
 * than a button that 403s.
 */
export function CopilotLauncher() {
    const intl = useIntl();
    const sessions = useCopilotSessions();
    const sidebarRef = useRef<HTMLButtonElement>(null);
    const newChatRef = useRef<HTMLButtonElement>(null);

    const canUse = useHasPermission(COPILOT_USE);
    const routeContext = useRouteContext();
    const { workspaceId } = routeContext;
    const available = canUse && !!workspaceId;

    const { start, visible } = sessions;
    // ⌘J / Ctrl+J starts a chat (design §2). Registered only while the launcher
    // is actually available, so the shortcut can't open a chat the user isn't
    // allowed to have or that has no workspace to run against.
    useEffect(() => {
        if (!available) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'j') return;
            if (!event.metaKey && !event.ctrlKey) return;
            event.preventDefault();
            start();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [available, start]);

    // Focus has to land somewhere when a window closes, and the dock's new-chat
    // button is the one control guaranteed to still be there. Without this it
    // falls to `<body>`, which strands keyboard users at the top of the page.
    const returnFocusRef = useRef<HTMLElement | null>(null);
    returnFocusRef.current = newChatRef.current;

    const slotOf = useCallback(
        (id: string) => visible.findIndex((s) => s.id === id),
        [visible]
    );

    if (!available) {
        return null;
    }

    return (
        <>
            <button
                ref={sidebarRef}
                type="button"
                onClick={() => sessions.start()}
                className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
            >
                <Sparkles className="size-4 shrink-0" />
                <span className="flex-1 text-left">
                    {intl.formatMessage(messages.open)}
                </span>
                <Kbd className="hidden sm:inline-flex">⌘J</Kbd>
            </button>

            {/* Portalled to `<body>`. This component is contributed to the
                sidebar's footer slot, so without a portal the fixed-position
                chrome below stays a DOM *descendant of the sidebar* — and
                inherits its styling. That is not hypothetical: the sidebar sets
                `text-sidebar-foreground` (a near-white, for its dark
                background), so the panel rendered near-white text on its own
                white surface at a 2.86:1 contrast ratio, well under the 4.5:1
                WCAG AA needs. A portal fixes the whole class of problem —
                colour, font, letter-spacing — rather than just the one symptom,
                and also protects the `position: fixed` from ever being trapped
                by a transform on an ancestor. React context still flows through
                portals, so the permission and workspace hooks are unaffected. */}
            {createPortal(
                <>
                    {/* Keyed by session **and** workspace: navigating to another
                        workspace must not hand an in-flight run a new
                        `X-Workspace-Id` half way through. */}
                    {sessions.all.map((session) => (
                        <CopilotSession
                            key={`${workspaceId}:${session.id}`}
                            session={session}
                            workspaceId={workspaceId}
                            routeContext={routeContext}
                            slot={slotOf(session.id)}
                            onMinimize={() => sessions.minimize(session.id)}
                            onClose={() => {
                                sessions.close(session.id);
                                newChatRef.current?.focus();
                            }}
                            onNewChat={() => sessions.start()}
                            onDescribe={(meta) =>
                                sessions.describe(session.id, meta)
                            }
                            onActivity={() => sessions.noteActivity(session.id)}
                        />
                    ))}

                    <CopilotDock
                        sessions={sessions.all}
                        onToggle={sessions.toggle}
                        onClose={sessions.close}
                        onNewChat={() => sessions.start()}
                        newChatRef={newChatRef}
                    />
                </>,
                document.body
            )}
        </>
    );
}
