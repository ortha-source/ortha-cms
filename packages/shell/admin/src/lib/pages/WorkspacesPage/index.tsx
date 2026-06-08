import { defineMessages, useIntl } from 'react-intl';

/** Intl descriptors for {@link WorkspacesPage}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'shell.workspaces.title',
        defaultMessage: 'Workspaces'
    }
});

/**
 * Placeholder Workspaces page rendered at `/workspaces` inside the
 * {@link AppShell}. A real workspaces feature plugin replaces this later — at
 * which point it contributes its own route and nav item and this is removed.
 */
export function WorkspacesPage() {
    const intl = useIntl();

    return (
        <section className="p-6">
            <h1 className="text-2xl font-semibold">
                {intl.formatMessage(messages.title)}
            </h1>
        </section>
    );
}
