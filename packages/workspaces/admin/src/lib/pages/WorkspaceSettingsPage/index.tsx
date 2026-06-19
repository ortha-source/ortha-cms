import { defineMessages, useIntl } from 'react-intl';
import { Container } from '@ortha-cms/design-system';
import { useCurrentWorkspace } from '../../utils/currentWorkspace';

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
    comingSoon: {
        id: 'workspaces.settings.comingSoon',
        defaultMessage: 'Workspace settings are coming soon.'
    }
});

/**
 * Placeholder workspace settings page, mounted inside the shell at
 * `/workspaces/:id/settings` (the rail's footer entry). Scaffold only — it reads
 * the open workspace from context and shows a heading; the real settings form
 * lands later.
 */
export function WorkspaceSettingsPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();

    return (
        <Container className="py-8">
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">
                {intl.formatMessage(messages.title)}
            </h1>
            <p className="mt-1 text-muted-foreground">
                {intl.formatMessage(messages.subtitle, {
                    workspace: workspace.name
                })}
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
                {intl.formatMessage(messages.comingSoon)}
            </p>
        </Container>
    );
}
