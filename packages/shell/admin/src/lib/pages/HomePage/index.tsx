import { defineMessages, useIntl } from 'react-intl';

/** Intl descriptors for {@link HomePage}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'shell.home.title',
        defaultMessage: 'Ortha CMS'
    },
    subtitle: {
        id: 'shell.home.subtitle',
        defaultMessage: 'Home'
    }
});

/**
 * Home page rendered at `/` inside the {@link AppShell} outlet. It is a private
 * route — only authenticated users reach it — and is the default landing target
 * after sign-in. A real dashboard replaces this placeholder in a later ticket.
 */
export function HomePage() {
    const intl = useIntl();

    return (
        <section className="flex min-h-svh flex-col items-center justify-center gap-2 p-6">
            <h1 className="text-2xl font-semibold">
                {intl.formatMessage(messages.title)}
            </h1>
            <p className="text-muted-foreground">
                {intl.formatMessage(messages.subtitle)}
            </p>
        </section>
    );
}
