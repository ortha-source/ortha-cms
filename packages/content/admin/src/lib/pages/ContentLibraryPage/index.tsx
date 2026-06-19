import { defineMessages, useIntl } from 'react-intl';
import { Container } from '@ortha-cms/design-system';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';

/** Intl descriptors for the content library page, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.library.title',
        defaultMessage: 'Content Library'
    },
    subtitle: {
        id: 'content.library.subtitle',
        defaultMessage: 'Browse and manage content in {workspace}.'
    },
    comingSoon: {
        id: 'content.library.comingSoon',
        defaultMessage: 'The content library is coming soon.'
    }
});

/**
 * Placeholder Content Library page, mounted inside the workspace shell at
 * `/workspaces/:id/content`. Scaffold only — it reads the open workspace from
 * the shell's context and shows a heading; the real entry list lands later.
 */
export function ContentLibraryPage() {
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
