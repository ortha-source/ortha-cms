import { defineMessages, useIntl } from 'react-intl';
import { AgentsRailList } from '../AgentsRailList';

const messages = defineMessages({
    label: {
        id: 'copilot.agents.rail.label',
        defaultMessage: 'Chats'
    }
});

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
 */
export function AgentsRail({ workspaceId }: { workspaceId: string }) {
    const intl = useIntl();

    return (
        <aside
            aria-label={intl.formatMessage(messages.label)}
            className="bg-muted/30 hidden w-72 shrink-0 flex-col border-r md:flex"
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
        </aside>
    );
}
