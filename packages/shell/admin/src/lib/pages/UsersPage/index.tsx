import { defineMessages, useIntl } from 'react-intl';

/** Intl descriptors for {@link UsersPage}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'shell.users.title',
        defaultMessage: 'Users'
    }
});

/**
 * Placeholder Users page rendered at `/users` inside the {@link AppShell}. A real
 * users feature plugin replaces this later — at which point it contributes its
 * own route and nav item and this is removed.
 */
export function UsersPage() {
    const intl = useIntl();

    return (
        <section className="p-6">
            <h1 className="text-2xl font-semibold">
                {intl.formatMessage(messages.title)}
            </h1>
        </section>
    );
}
