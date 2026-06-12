import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Container, ContainerHeader, Spinner } from '@ortha-cms/design-system';
import { useWorkspaces } from '../../api/useWorkspaces';
import { WorkspaceCard } from '../../components/WorkspaceCard';
import { WorkspacesEmpty } from '../../components/WorkspacesEmpty';
import {
    WorkspaceToolbar,
    DEFAULT_STATUS,
    type StatusFilter
} from '../../components/WorkspaceToolbar';
import type { Workspace } from '../../types/workspace';

/** Intl descriptors for {@link WorkspacesPage}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'workspaces.page.title',
        defaultMessage: 'Workspaces'
    },
    subtitle: {
        id: 'workspaces.page.subtitle',
        defaultMessage:
            'Each workspace groups its own content, members, and plugins. Switch in to manage one, or spin up a new one.'
    }
});

/** Matches a workspace against the status filter. */
function matchesStatus(workspace: Workspace, status: StatusFilter): boolean {
    return status === 'All' || workspace.status === status;
}

/** Matches a workspace name or description against the search query. */
function matchesSearch(workspace: Workspace, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
        workspace.name.toLowerCase().includes(needle) ||
        workspace.description.toLowerCase().includes(needle)
    );
}

/**
 * The Workspaces management page: a searchable, status-filterable grid of
 * workspace cards, reading the signed-in user's workspaces from the API.
 * Rendered at `/workspaces` inside the authenticated shell.
 *
 * TODO(workspaces-create): the create flow is built (CreateWorkspaceDialog +
 * useCreateWorkspace) but its entry point is hidden until the server ships a
 * create endpoint — the API is read-only today.
 */
export function WorkspacesPage() {
    const intl = useIntl();
    const { data: workspaces = [], isLoading } = useWorkspaces();

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<StatusFilter>(DEFAULT_STATUS);

    const filtered = useMemo(
        () =>
            workspaces.filter(
                (workspace) =>
                    matchesStatus(workspace, status) &&
                    matchesSearch(workspace, search)
            ),
        [workspaces, status, search]
    );

    // Resets back to the widest view. Clearing lands on `All` (not the default
    // `Active`) so it reveals every workspace — including archived ones the
    // default view hides — matching the empty-state's "see them all" copy. This
    // also unsticks the all-archived case, where resetting to `Active` would
    // leave the grid empty and the clear button a no-op.
    const clearFilters = () => {
        setSearch('');
        setStatus('All');
    };

    return (
        <Container>
            <ContainerHeader
                title={intl.formatMessage(messages.title)}
                subtitle={intl.formatMessage(messages.subtitle)}
            />

            <WorkspaceToolbar
                search={search}
                onSearchChange={setSearch}
                status={status}
                onStatusChange={setStatus}
                shown={filtered.length}
                total={workspaces.length}
            />

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Spinner />
                </div>
            ) : filtered.length === 0 ? (
                <WorkspacesEmpty
                    // "No match / clear filters" whenever workspaces exist but
                    // the current view hides them all (e.g. a search miss, or
                    // the default Active filter with only archived workspaces);
                    // the "no workspaces yet" variant is reserved for a
                    // genuinely empty list.
                    filtered={workspaces.length > 0}
                    onClear={clearFilters}
                />
            ) : (
                <div
                    className="grid gap-4"
                    style={{
                        gridTemplateColumns:
                            'repeat(auto-fill, minmax(min(100%, 320px), 1fr))'
                    }}
                >
                    {filtered.map((workspace) => (
                        <WorkspaceCard
                            key={workspace.id}
                            workspace={workspace}
                        />
                    ))}
                </div>
            )}
        </Container>
    );
}
