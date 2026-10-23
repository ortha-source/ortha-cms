import { Navigate, Route, Routes, useMatch } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { useHasPermission } from '@orthacms/identity-admin';
import { Badge, Container, ContainerHeader } from '@orthacms/design-system';
import { useCurrentWorkspace } from '../../currentWorkspace';
import { WorkspaceSettingsNav } from '../../components/WorkspaceSettingsNav';
import { useDocumentTitle } from '@orthacms/utils-admin';
import { WorkspaceSettingsTopBar } from '../../components/WorkspaceSettingsTopBar';
import { useRedirectNotice } from '../../hooks/useRedirectNotice';
import { WorkspaceGeneralSettings } from '../../components/WorkspaceGeneralSettings';
import { WorkspaceSharingSettings } from '../../components/WorkspaceSharingSettings';
import { WorkspaceMembersSettings } from '../../components/WorkspaceMembersSettings';
import { WorkspaceContentSettings } from '../../components/WorkspaceContentSettings';
import { WorkspaceDangerSettings } from '../../components/WorkspaceDangerSettings';
import { WORKSPACE_SETTINGS_TAB_SLOT } from '../../slots/workspaceSlots';

/** Intl descriptors for the workspace settings page, co-located here. */
const messages = defineMessages({
    documentTitle: {
        id: 'workspaces.settings.documentTitle',
        defaultMessage: 'Settings · {name}'
    },
    dangerDenied: {
        id: 'workspaces.settings.dangerDenied',
        defaultMessage:
            'You don’t have permission to open the Danger zone, so we brought you to General settings.'
    },
    generalTitle: {
        id: 'workspaces.settings.section.generalTitle',
        defaultMessage: 'General'
    },
    generalSubtitle: {
        id: 'workspaces.settings.section.generalSubtitle',
        defaultMessage:
            'How this workspace is named and shown, and whether other workspaces may use its records.'
    },
    contentTitle: {
        id: 'workspaces.settings.section.contentTitle',
        defaultMessage: 'Content types'
    },
    contentSubtitle: {
        id: 'workspaces.settings.section.contentSubtitle',
        defaultMessage:
            'Which types this workspace holds. Its own records are written here; a shared type is read from the workspace that offers it.'
    },
    membersTitle: {
        id: 'workspaces.settings.section.membersTitle',
        defaultMessage: 'Members'
    },
    membersSubtitle: {
        id: 'workspaces.settings.section.membersSubtitle',
        defaultMessage:
            'Who can open this workspace. What each person may do comes from their role, which is set once for the whole CMS.'
    },
    dangerTitle: {
        id: 'workspaces.settings.section.dangerTitle',
        defaultMessage: 'Danger zone'
    },
    dangerSubtitle: {
        id: 'workspaces.settings.section.dangerSubtitle',
        defaultMessage:
            'Actions that take the workspace out of use. Each one asks first.'
    },
    archivedBadge: {
        id: 'workspaces.settings.archivedBadge',
        defaultMessage: 'Archived'
    }
});

/**
 * Workspace settings, mounted inside the shell at `/workspaces/:id/settings/*`.
 * A side nav ({@link WorkspaceSettingsNav}: General, Content types, Members,
 * contributed sections, Danger zone) beside one 720px column — the webhook
 * editor's shape. Each section is its own nested route, and the column opens
 * on that section's `<h1>` and one-line subtitle.
 *
 * Reads the open workspace from context; edits are gated by `workspaces:update`
 * / `workspaces:delete`, so a viewer sees a read-only page and the Danger
 * section (rail entry + route) only exists when the user can act on it.
 *
 * Plugin-contributed sections ({@link WORKSPACE_SETTINGS_TAB_SLOT}) mount as
 * ordinary nested routes. Unlike the Danger zone they are **not** gated here:
 * the tab bar already hides an entry the caller may not use, and a section that
 * can say "you need `protection:manage` for this" is a better answer to a deep
 * link than a redirect to a page nobody asked for.
 */
export function WorkspaceSettingsPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const canUpdate = useHasPermission('workspaces:update');
    const canDelete = useHasPermission('workspaces:delete');
    const showDanger = canUpdate || canDelete;
    const redirectNotice = useRedirectNotice();
    const header = useSectionHeader();
    useDocumentTitle(
        intl.formatMessage(messages.documentTitle, { name: workspace.name })
    );

    return (
        <>
            <WorkspaceSettingsTopBar />
            <Container>
                {/* The Danger tab is gated on the route as well as the nav,
                    so a deep link swaps the section out from under the user. */}
                <span role="status" aria-live="polite" className="sr-only">
                    {redirectNotice === 'danger-denied'
                        ? intl.formatMessage(messages.dangerDenied)
                        : ''}
                </span>
                <div className="flex flex-col gap-6 lg:flex-row lg:justify-center lg:gap-12">
                    <WorkspaceSettingsNav
                        workspaceId={workspace.id}
                        showDanger={showDanger}
                        contentCount={
                            workspace.content.length +
                            workspace.sharedContent.length
                        }
                        memberCount={workspace.members.length}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-5 lg:max-w-[720px]">
                        {/* The section's own name is the `<h1>` — the top
                            bar's crumbs already say Settings. The Archived
                            mark rides the actions region, the way the entry
                            editor's marks about the record do. */}
                        <ContainerHeader
                            className="mb-0"
                            title={header.title}
                            subtitle={header.subtitle}
                            actions={
                                workspace.status === 'Archived' ? (
                                    <Badge variant="secondary">
                                        {intl.formatMessage(
                                            messages.archivedBadge
                                        )}
                                    </Badge>
                                ) : undefined
                            }
                        />
                        <Routes>
                            <Route
                                index
                                element={<Navigate to="general" replace />}
                            />
                            <Route
                                path="general"
                                element={
                                    <div className="flex flex-col gap-5">
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
                                        {/* A sibling, not part of the form
                                            above: the switch applies on its
                                            own, and sits outside that key so
                                            a profile save doesn't remount it
                                            mid-toggle. */}
                                        <WorkspaceSharingSettings
                                            workspace={workspace}
                                            canUpdate={canUpdate}
                                        />
                                    </div>
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
                                        <Navigate
                                            to="../general"
                                            replace
                                            state={{
                                                redirectNotice: 'danger-denied'
                                            }}
                                        />
                                    )
                                }
                            />
                            {WORKSPACE_SETTINGS_TAB_SLOT.getItems().map(
                                (tab) => (
                                    <Route
                                        key={tab.id}
                                        path={tab.path}
                                        element={tab.element}
                                    />
                                )
                            )}
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

/**
 * The open section's `<h1>` and subtitle, from the route: a built-in section's
 * own copy, or a contributed one's label and description.
 */
function useSectionHeader(): { title: string; subtitle?: string } {
    const intl = useIntl();
    const match = useMatch('/workspaces/:workspaceId/settings/:section/*');
    const section = match?.params.section ?? 'general';
    switch (section) {
        case 'content':
            return {
                title: intl.formatMessage(messages.contentTitle),
                subtitle: intl.formatMessage(messages.contentSubtitle)
            };
        case 'members':
            return {
                title: intl.formatMessage(messages.membersTitle),
                subtitle: intl.formatMessage(messages.membersSubtitle)
            };
        case 'danger':
            return {
                title: intl.formatMessage(messages.dangerTitle),
                subtitle: intl.formatMessage(messages.dangerSubtitle)
            };
        case 'general':
            break;
        default: {
            const tab = WORKSPACE_SETTINGS_TAB_SLOT.getItems().find(
                (item) => item.path === section
            );
            if (tab) {
                return {
                    title: intl.formatMessage({
                        id: tab.labelId,
                        defaultMessage: tab.defaultLabel
                    }),
                    subtitle: tab.descriptionId
                        ? intl.formatMessage({
                              id: tab.descriptionId,
                              defaultMessage: tab.defaultDescription
                          })
                        : undefined
                };
            }
        }
    }
    return {
        title: intl.formatMessage(messages.generalTitle),
        subtitle: intl.formatMessage(messages.generalSubtitle)
    };
}
