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
            <AgentsRailList workspaceId={workspaceId} />
        </aside>
    );
}
