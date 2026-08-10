import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useCopilotSessions } from '../../application/useCopilotSessions';
import { useRouteContext } from '../../application/useRouteContext';
import { badgeCount } from '../../application/tabBadge';
import { useTabBadge } from '../../application/useTabBadge';
import { COPILOT_USE, isAgentsPath } from '../../domain/agentsRoute';
import { CopilotDock } from '../CopilotDock';
import { CopilotSession } from '../CopilotSession';

/**
 * The entry points, the chats they start, and the dock that lists them.
 *
 * Contributed to `SIDEBAR_FOOTER_SLOT`, so it is present across the global and
 * per-workspace sidebars — but it renders **nothing outside a workspace**, and
 * nothing for a user without `copilot:use`. Runs are workspace-scoped
 * (`X-Workspace-Id` is required by `WorkspaceGuard`), so offering a chat where
 * there is no open workspace would only produce a 400.
 *
 * **The dock is the only entry point.** There was a floating button, and then
 * a sidebar row beside it; both are gone. A round button could only ever mean
 * "the panel", singular, and a sidebar row duplicated what the dock already
 * says while spending a permanent slot in navigation on it. With no chats open
 * the dock *is* a labelled Ortha AI button in the corner, and as soon as there
 * are chats it becomes the bar listing them — one control that grows into the
 * thing it opens.
 *
 * `⌘J` is still the shortcut. Its discoverability moved onto the dock's own
 * button, which shows the hint while it is the only thing there.
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
    const sessions = useCopilotSessions();
    const newChatRef = useRef<HTMLButtonElement>(null);
    const { pathname } = useLocation();

    const canUse = useHasPermission(COPILOT_USE);
    const routeContext = useRouteContext();
    const { workspaceId } = routeContext;
    const available = canUse && !!workspaceId;

    // On the Agents view the dock's own button offers to open the page the user
    // is already on, so it stands down — but only the **bar**, and only while
    // the dock owns nothing. A chat the page handed back (you navigated away
    // mid-answer) is a pill that has to stay reachable.
    const dockRedundant = isAgentsPath(pathname) && sessions.dock.length === 0;

    // The tab badge lives here for the same reason the dock does: this is the
    // one copilot component mounted for the whole session, so it can count
    // chats that want the user back no matter which page is open. It counts
    // **every** chat, not just the dock's — a page-presented one cannot be
    // awaiting and unseen, but it costs nothing to be right about it.
    useTabBadge(badgeCount(sessions.all));

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

    // Nothing is rendered into the sidebar slot itself any more — only the
    // portalled dock and its windows. The slot contribution stays because it is
    // what mounts this component at all.
    return (
        <>
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
                    {sessions.dock.map((session) => (
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
                            onAwaiting={(value) =>
                                sessions.setAwaiting(session.id, value)
                            }
                            onChoiceChange={(choice) =>
                                sessions.setModel(session.id, choice)
                            }
                        />
                    ))}

                    {!dockRedundant && (
                        <CopilotDock
                            sessions={sessions.dock}
                            onToggle={sessions.toggle}
                            onClose={sessions.close}
                            onNewChat={() => sessions.start()}
                            newChatRef={newChatRef}
                        />
                    )}
                </>,
                document.body
            )}
        </>
    );
}
