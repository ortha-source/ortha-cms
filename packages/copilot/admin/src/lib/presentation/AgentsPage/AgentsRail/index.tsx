import { defineMessages, useIntl } from 'react-intl';
import { ResizeHandle, useResizablePanel } from '@orthacms/design-system';
import { AgentsRailList } from '../AgentsRailList';

const messages = defineMessages({
    label: {
        id: 'copilot.agents.rail.label',
        defaultMessage: 'Chats'
    },
    resize: {
        id: 'copilot.agents.rail.resize',
        defaultMessage: 'Resize chats'
    }
});

/**
 * The rail's entry in the shell's panel layout, and its bounds in pixels. It
 * does not collapse: the conversation beside it is what the page is for, and a
 * rail dragged past its minimum simply stops there.
 */
export const AGENTS_RAIL_PANEL = {
    id: 'copilot.agentsRail',
    defaultWidth: 288,
    minWidth: 224,
    maxWidth: 448,
    maxViewportRatio: 0.25,
    cssVar: '--agents-rail-width'
} as const;

/** DOM id of the rail, for the resize handle's `aria-controls`. */
const RAIL_ID = 'agents-rail';

/**
 * The thread column, on screens wide enough to spend 18rem on it.
 *
 * Below `md` it is not there at all: a phone that gave the rail its own column
 * would have nothing left for the conversation, which is the thing the page is
 * for. The same list is reachable from the thread header's Chats button, which
 * opens it in a sheet — see {@link AgentsThread}.
 *
 * It is a **third** column, after the app sidebar's per-workspace nav. That is
 * the point rather than an accident: the CMS navigation stays on screen while
 * you are in the Agents view, so switching back is one click on something you
 * can already see — not a trip through a menu.
 *
 * Its width is the user's: a handle on its right edge drags it between
 * {@link AGENTS_RAIL_PANEL}'s bounds, remembered with the rest of the panel
 * layout.
 */
export function AgentsRail({ workspaceId }: { workspaceId: string }) {
    const intl = useIntl();
    const panel = useResizablePanel(AGENTS_RAIL_PANEL);

    return (
        <aside
            id={RAIL_ID}
            ref={panel.ref}
            style={panel.style}
            aria-label={intl.formatMessage(messages.label)}
            className="bg-muted/30 relative hidden w-(--agents-rail-width) shrink-0 flex-col border-r md:flex"
        >
            {/* The rail's own heading, visually hidden. Its date buckets are
                `<h3>`s, and with the page's `<h1>` now in place they would jump
                straight from 1 to 3 — the rank they have is right relative to
                *this* column, so the column supplies the level in between
                rather than the buckets being demoted (`ORT-168` is the same
                rule, from the other end). It reuses the landmark's own name, so
                the rail is announced identically whichever way it is reached. */}
            <h2 className="sr-only">{intl.formatMessage(messages.label)}</h2>
            <AgentsRailList workspaceId={workspaceId} />
            <ResizeHandle
                {...panel.handleProps}
                edge="right"
                controls={RAIL_ID}
                label={intl.formatMessage(messages.resize)}
            />
        </aside>
    );
}
