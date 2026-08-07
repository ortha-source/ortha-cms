import { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Sparkles } from 'lucide-react';
import { cn, Kbd } from '@ortha-cms/design-system';
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
    },
    openHint: {
        id: 'copilot.launcher.openHint',
        defaultMessage: 'Open Ortha AI (⌘J)'
    }
});

/** The permission the whole surface is gated on. */
const COPILOT_USE = 'copilot:use';

/**
 * The two entry points, and the panel they open.
 *
 * Contributed to `SIDEBAR_FOOTER_SLOT`, so it is present across the global and
 * per-workspace sidebars — but it renders **nothing outside a workspace**, and
 * nothing for a user without `copilot:use`. Runs are workspace-scoped
 * (`X-Workspace-Id` is required by `WorkspaceGuard`), so offering the panel
 * where there is no open workspace would only produce a 400.
 *
 * Two triggers, one panel: a sidebar row (which carries the `⌘J` hint, so the
 * shortcut is discoverable) and a floating button in the corner the panel
 * itself opens from. The floating button hides while the panel is open, since
 * the panel covers that corner — and focus returns to **whichever** trigger was
 * used, not always the sidebar one.
 *
 * The permission check mirrors the server's gate rather than replacing it: the
 * route enforces `copilot:use` regardless, and `useHasPermission` is
 * fail-closed, so a user whose permissions haven't loaded sees nothing rather
 * than a button that 403s.
 */
export function CopilotLauncher() {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const sidebarRef = useRef<HTMLButtonElement>(null);
    const floatingRef = useRef<HTMLButtonElement>(null);
    // The panel is non-modal, so nothing restores focus for us on close — and
    // returning it to the sidebar after opening from the corner would throw
    // keyboard focus across the screen.
    const returnFocusRef = useRef<HTMLElement | null>(null);

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
            setOpen((current) => {
                if (!current) {
                    // Opened by keyboard from anywhere on the page: send focus
                    // back to the corner button, which is where the panel
                    // visually came from.
                    returnFocusRef.current = floatingRef.current;
                }
                return !current;
            });
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [available]);

    if (!available) {
        return null;
    }

    const openFrom = (trigger: HTMLElement | null) => {
        returnFocusRef.current = trigger;
        setOpen(true);
    };

    return (
        <>
            <button
                ref={sidebarRef}
                type="button"
                onClick={() => openFrom(sidebarRef.current)}
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

            <button
                ref={floatingRef}
                type="button"
                onClick={() => openFrom(floatingRef.current)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={intl.formatMessage(messages.openHint)}
                title={intl.formatMessage(messages.openHint)}
                // While the panel is open the button is faded out but still in
                // the DOM, so it must leave the tab order and the accessibility
                // tree — an invisible-but-tabbable button is a trap, and the
                // panel is non-modal so Tab really does reach it. Both revert
                // on close, before focus is returned here.
                tabIndex={open ? -1 : 0}
                aria-hidden={open}
                className={cn(
                    'bg-primary text-primary-foreground fixed right-4 bottom-4 z-40',
                    'flex size-12 items-center justify-center rounded-full shadow-lg',
                    'hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    // `translate`/`scale`, not `transform` — Tailwind v4 emits
                    // them as standalone properties (see the panel's note).
                    'origin-bottom-right transition-[opacity,translate,scale] duration-200 ease-out',
                    'motion-reduce:transition-none',
                    // Faded rather than unmounted, so the button keeps its place
                    // for focus to return to. Deliberately NOT `invisible`:
                    // `visibility` is not a transitionable property, so it would
                    // snap to hidden on the first frame and swallow the fade.
                    open && 'pointer-events-none scale-90 opacity-0'
                )}
            >
                <Sparkles className="size-5" />
            </button>

            <CopilotPanel
                workspaceId={workspaceId}
                open={open}
                onOpenChange={setOpen}
                returnFocusRef={returnFocusRef}
            />
        </>
    );
}
