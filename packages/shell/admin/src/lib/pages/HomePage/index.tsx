import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { LayoutGridIcon, UsersIcon } from 'lucide-react';
import { Logo, Card, CardContent } from '@ortha-cms/design-system';
import { useAuth } from '@ortha-cms/identity-admin';

/** Intl descriptors for {@link HomePage}, co-located with the component. */
const messages = defineMessages({
    greetingMorning: {
        id: 'shell.home.greeting.morning',
        defaultMessage: 'Good morning, {name}'
    },
    greetingAfternoon: {
        id: 'shell.home.greeting.afternoon',
        defaultMessage: 'Good afternoon, {name}'
    },
    greetingEvening: {
        id: 'shell.home.greeting.evening',
        defaultMessage: 'Good evening, {name}'
    },
    subtitle: {
        id: 'shell.home.subtitle',
        defaultMessage:
            'Everything your team builds, in one place — shape the content, bring the right people in, and extend it all with plugins.'
    },
    workspacesTitle: {
        id: 'shell.home.card.workspaces.title',
        defaultMessage: 'Workspaces'
    },
    workspacesDescription: {
        id: 'shell.home.card.workspaces.description',
        defaultMessage: 'Organize content and collaborators by workspace.'
    },
    usersTitle: {
        id: 'shell.home.card.users.title',
        defaultMessage: 'Users'
    },
    usersDescription: {
        id: 'shell.home.card.users.description',
        defaultMessage: 'Invite teammates and manage roles and access.'
    }
});

/** Picks the time-of-day greeting descriptor from the local hour. */
function greetingFor(hour: number) {
    if (hour < 12) return messages.greetingMorning;
    if (hour < 18) return messages.greetingAfternoon;
    return messages.greetingEvening;
}

/**
 * Home page rendered at `/` inside the {@link AppShell} outlet. A private route —
 * only authenticated users reach it — and the default landing target after
 * sign-in. Greets the signed-in user and surfaces the two primary destinations
 * as navigating cards.
 */
export function HomePage() {
    const intl = useIntl();
    const { user } = useAuth();
    const greeting = greetingFor(new Date().getHours());

    const cards = [
        {
            to: '/workspaces',
            Icon: LayoutGridIcon,
            title: messages.workspacesTitle,
            description: messages.workspacesDescription
        },
        {
            to: '/users',
            Icon: UsersIcon,
            title: messages.usersTitle,
            description: messages.usersDescription
        }
    ];

    return (
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-16 text-center">
            <Logo showLabel={false} size="lg" />
            <h1 className="text-3xl font-semibold tracking-tight">
                {intl.formatMessage(greeting, {
                    name: user?.name ?? user?.email ?? ''
                })}
            </h1>
            <p className="max-w-md text-muted-foreground">
                {intl.formatMessage(messages.subtitle)}
            </p>
            <div className="mt-4 grid w-full gap-4 sm:grid-cols-2">
                {cards.map(({ to, Icon, title, description }) => (
                    <Link
                        key={to}
                        to={to}
                        className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Card className="h-full text-left transition-colors hover:bg-accent">
                            <CardContent className="flex flex-col gap-3 p-5">
                                <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                                    <Icon className="size-4" />
                                </span>
                                <span className="font-medium">
                                    {intl.formatMessage(title)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    {intl.formatMessage(description)}
                                </span>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </section>
    );
}
