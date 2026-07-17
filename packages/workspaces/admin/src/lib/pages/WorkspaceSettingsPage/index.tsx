import { Navigate, Route, Routes } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { Badge, Container } from '@ortha-cms/design-system';
import { useCurrentWorkspace } from '../../utils/currentWorkspace';
import { WorkspaceSettingsTabs } from '../../components/WorkspaceSettingsTabs';
import { WorkspaceSettingsTopBar } from '../../components/WorkspaceSettingsTopBar';
import { WorkspaceGeneralSettings } from '../../components/WorkspaceGeneralSettings';
import { WorkspaceMembersSettings } from '../../components/WorkspaceMembersSettings';
import { WorkspaceContentSettings } from '../../components/WorkspaceContentSettings';
import { WorkspaceDangerSettings } from '../../components/WorkspaceDangerSettings';

/** Intl descriptors for the workspace settings page, co-located here. */
const messages = defineMessages({
    title: {
        id: 'workspaces.settings.title',
        defaultMessage: 'Settings'
    },
    subtitle: {
        id: 'workspaces.settings.subtitle',
        defaultMessage: 'Manage settings for {workspace}.'
    },
    archivedBadge: {
        id: 'workspaces.settings.archivedBadge',
        defaultMessage: 'Archived'
    }
});

/**
 * Workspace settings, mounted inside the shell at `/workspaces/:id/settings/*`.
 * A tabbed layout — General, Members, Content, and a Danger zone — each its own
 * nested route under the {@link WorkspaceSettingsTabs} underline tab bar,
 * mirroring the user-detail page. The page width is the shared `Container`.
 *
 * Reads the open workspace from context; edits are gated by `workspaces:update`
 * / `workspaces:delete`, so a viewer sees a read-only page and the Danger
 * section (rail entry + route) only exists when the user can act on it.
 */
export function WorkspaceSettingsPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const canUpdate = useHasPermission('workspaces:update');
    const canDelete = useHasPermission('workspaces:delete');
    const showDanger = canUpdate || canDelete;

    return (
        <>
            <WorkspaceSettingsTopBar />
            <Container className="space-y-6 py-8">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold tracking-[-0.01em]">
                            {intl.formatMessage(messages.title)}
                        </h1>
                        {workspace.status === 'Archived' ? (
                            <Badge variant="secondary">
                                {intl.formatMessage(messages.archivedBadge)}
                            </Badge>
                        ) : null}
                    </div>
                    <p className="mt-1 text-muted-foreground">
                        {intl.formatMessage(messages.subtitle, {
                            workspace: workspace.name
                        })}
                    </p>
                </div>

                <div className="flex flex-col gap-6">
                    <WorkspaceSettingsTabs
                        workspaceId={workspace.id}
                        showDanger={showDanger}
                    />
                    <div className="min-w-0">
                        <Routes>
                            <Route
                                index
                                element={<Navigate to="general" replace />}
                            />
                            <Route
                                path="general"
                                element={
                                    <WorkspaceGeneralSettings
                                        // Re-key on the editable fields so an
                                        // external change (e.g. another admin's edit
                                        // arriving via a list refetch) re-baselines
                                        // the form + color state instead of leaving
                                        // stale values a Save would overwrite.
                                        key={`${workspace.id}:${workspace.name}:${workspace.description}:${workspace.color}`}
                                        workspace={workspace}
                                        canUpdate={canUpdate}
                                    />
                                }
                            />
                            <Route
                                path="members"
                                element={
                                    <WorkspaceMembersSettings
                                        workspace={workspace}
                                        canUpdate={canUpdate}
                                    />
                                }
                            />
                            <Route
                                path="content"
                                element={
                                    <WorkspaceContentSettings
                                        workspace={workspace}
                                        canUpdate={canUpdate}
                                    />
                                }
                            />
                            <Route
                                path="danger"
                                element={
                                    showDanger ? (
                                        <WorkspaceDangerSettings
                                            workspace={workspace}
                                            canUpdate={canUpdate}
                                            canDelete={canDelete}
                                        />
                                    ) : (
                                        <Navigate to="../general" replace />
                                    )
                                }
                            />
                            {/* Unknown sub-path falls back to the first section. */}
                            <Route
                                path="*"
                                element={<Navigate to="general" replace />}
                            />
                        </Routes>
                    </div>
                </div>
            </Container>
        </>
    );
}
