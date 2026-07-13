import { defineMessages, useIntl } from 'react-intl';
import { FileStack, Layers, Users } from 'lucide-react';
import { StatTile } from '@ortha-cms/design-system';
import { useWorkspaces } from '../../api/useWorkspaces';

/** Intl descriptors for {@link WorkspaceStats}, co-located here. */
const messages = defineMessages({
    activeWorkspaces: {
        id: 'workspaces.stats.active',
        defaultMessage: 'Active workspaces'
    },
    members: {
        id: 'workspaces.stats.members',
        defaultMessage: 'Members'
    },
    contentTypes: {
        id: 'workspaces.stats.contentTypes',
        defaultMessage: 'Content types'
    }
});

/** A placeholder shown for a metric while the list query is in flight. */
const LOADING = '—';

/**
 * The home dashboard's workspace stat tiles: active-workspace count, the number
 * of distinct members across all workspaces, and the number of distinct content
 * types granted — all derived from the real `GET /api/workspaces` payload (no
 * separate metrics API yet). Rendered as a `display: contents` group so the
 * three tiles flow directly into the home page's stat grid.
 */
export function WorkspaceStats() {
    const intl = useIntl();
    const { data: workspaces, isPending } = useWorkspaces();

    const active = workspaces?.filter((w) => w.status === 'Active').length ?? 0;
    const members = new Set(
        (workspaces ?? []).flatMap((w) => w.members.map((m) => m.id))
    ).size;
    const contentTypes = new Set(
        (workspaces ?? []).flatMap((w) => w.content)
    ).size;

    return (
        <div className="contents">
            <StatTile
                value={isPending ? LOADING : active}
                label={intl.formatMessage(messages.activeWorkspaces)}
                icon={Layers}
            />
            <StatTile
                value={isPending ? LOADING : members}
                label={intl.formatMessage(messages.members)}
                icon={Users}
            />
            <StatTile
                value={isPending ? LOADING : contentTypes}
                label={intl.formatMessage(messages.contentTypes)}
                icon={FileStack}
            />
        </div>
    );
}
