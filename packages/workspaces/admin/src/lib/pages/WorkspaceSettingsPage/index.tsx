import { defineMessages, useIntl } from 'react-intl';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    Badge,
    Container,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@ortha-cms/design-system';
import { useCurrentWorkspace } from '../../utils/currentWorkspace';
import { WorkspaceGeneralSettings } from '../../components/WorkspaceGeneralSettings';
import { WorkspaceMembersSettings } from '../../components/WorkspaceMembersSettings';
import { WorkspaceContentSettings } from '../../components/WorkspaceContentSettings';
import { WorkspaceDangerSettings } from '../../components/WorkspaceDangerSettings';

/** Tab ids for the settings page, kept as constants so they don't drift. */
const TAB = {
    General: 'general',
    Members: 'members',
    Content: 'content',
    Danger: 'danger'
} as const;

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
    },
    tabGeneral: {
        id: 'workspaces.settings.tab.general',
        defaultMessage: 'General'
    },
    tabMembers: {
        id: 'workspaces.settings.tab.members',
        defaultMessage: 'Members'
    },
    tabContent: {
        id: 'workspaces.settings.tab.content',
        defaultMessage: 'Content'
    },
    tabDanger: {
        id: 'workspaces.settings.tab.danger',
        defaultMessage: 'Danger zone'
    }
});

/**
 * Workspace settings, mounted inside the shell at `/workspaces/:id/settings`
 * (the rail's footer entry). A tabbed page — General (name/description/color),
 * Members, Content types, and a Danger zone (archive/delete). Reads the open
 * workspace from context; edits are gated by `workspaces:update` /
 * `workspaces:delete`, so a viewer sees a read-only page and the Danger tab only
 * appears when the user can act on it.
 */
export function WorkspaceSettingsPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const canUpdate = useHasPermission('workspaces:update');
    const canDelete = useHasPermission('workspaces:delete');
    const showDanger = canUpdate || canDelete;

    return (
        <Container className="py-8">
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

            <Tabs defaultValue={TAB.General} className="mt-6">
                <TabsList>
                    <TabsTrigger value={TAB.General}>
                        {intl.formatMessage(messages.tabGeneral)}
                    </TabsTrigger>
                    <TabsTrigger value={TAB.Members}>
                        {intl.formatMessage(messages.tabMembers)}
                    </TabsTrigger>
                    <TabsTrigger value={TAB.Content}>
                        {intl.formatMessage(messages.tabContent)}
                    </TabsTrigger>
                    {showDanger ? (
                        <TabsTrigger value={TAB.Danger}>
                            {intl.formatMessage(messages.tabDanger)}
                        </TabsTrigger>
                    ) : null}
                </TabsList>

                <TabsContent value={TAB.General} className="mt-4">
                    <WorkspaceGeneralSettings
                        workspace={workspace}
                        canUpdate={canUpdate}
                    />
                </TabsContent>
                <TabsContent value={TAB.Members} className="mt-4">
                    <WorkspaceMembersSettings
                        workspace={workspace}
                        canUpdate={canUpdate}
                    />
                </TabsContent>
                <TabsContent value={TAB.Content} className="mt-4">
                    <WorkspaceContentSettings
                        workspace={workspace}
                        canUpdate={canUpdate}
                    />
                </TabsContent>
                {showDanger ? (
                    <TabsContent value={TAB.Danger} className="mt-4">
                        <WorkspaceDangerSettings
                            workspace={workspace}
                            canUpdate={canUpdate}
                            canDelete={canDelete}
                        />
                    </TabsContent>
                ) : null}
            </Tabs>
        </Container>
    );
}
