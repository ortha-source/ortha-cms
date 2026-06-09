import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    Button,
    Container,
    ContainerHeader,
    Spinner
} from '@ortha-cms/design-system';
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
    },
    newWorkspace: {
        id: 'workspaces.page.newWorkspace',
        defaultMessage: 'New workspace'
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
 * workspace cards with a create flow. Rendered at `/workspaces` inside the
 * authenticated shell.
 */
export function WorkspacesPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const { data: workspaces = [], isLoading } = useWorkspaces();

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<StatusFilter>(DEFAULT_STATUS);

    const openCreate = () => navigate('/workspaces/new');

    const filtered = useMemo(
        () =>
            workspaces.filter(
                (workspace) =>
                    matchesStatus(workspace, status) &&
                    matchesSearch(workspace, search)
            ),
        [workspaces, status, search]
    );

    const isFiltering = search.trim() !== '' || status !== DEFAULT_STATUS;

    const clearFilters = () => {
        setSearch('');
        setStatus(DEFAULT_STATUS);
    };

    return (
        <Container>
            <ContainerHeader
                title={intl.formatMessage(messages.title)}
                subtitle={intl.formatMessage(messages.subtitle)}
                actions={
                    <Button onClick={openCreate}>
                        <Plus />
                        {intl.formatMessage(messages.newWorkspace)}
                    </Button>
                }
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
                    filtered={isFiltering}
                    onClear={clearFilters}
                    onCreate={openCreate}
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
