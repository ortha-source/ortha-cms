import { defineMessages, useIntl } from 'react-intl';
import { Container } from '@ortha-cms/design-system';
import { useAuth } from '@ortha-cms/identity-admin';
import { HOME_SECTION_SLOT } from '../../slots/homeSlots';

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
        defaultMessage: 'Here’s what’s happening across your workspaces.'
    }
});

/** Picks the time-of-day greeting descriptor from the local hour. */
function greetingFor(hour: number) {
    if (hour < 12) return messages.greetingMorning;
    if (hour < 18) return messages.greetingAfternoon;
    return messages.greetingEvening;
}

/** Sorts a slot's items by ascending `order`. */
function byOrder<T extends { order: number }>(items: T[]): T[] {
    return items.slice().sort((a, b) => a.order - b.order);
}

/**
 * Home page rendered at `/` inside the {@link AppShell} outlet. A private route,
 * and the default landing after sign-in. Greets the signed-in user, then
 * assembles the dashboard from {@link HOME_SECTION_SLOT}: a top row of stat
 * tiles and a two-column grid of panels (Workspaces, Recent activity), each
 * contributed by its owning plugin so the shell stays feature-agnostic.
 */
export function HomePage() {
    const intl = useIntl();
    const { user } = useAuth();
    const greeting = greetingFor(new Date().getHours());

    const sections = byOrder(HOME_SECTION_SLOT.getItems());
    const stats = sections.filter((section) => section.region === 'stat');
    const panels = sections.filter((section) => section.region === 'panel');

    return (
        <Container className="py-8">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-semibold tracking-tight">
                    {intl.formatMessage(greeting, {
                        name: user?.name ?? user?.email ?? ''
                    })}
                </h1>
                <p className="text-muted-foreground">
                    {intl.formatMessage(messages.subtitle)}
                </p>
            </header>

            {stats.length > 0 ? (
                <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                    {stats.map(({ id, Component }) => (
                        <Component key={id} />
                    ))}
                </div>
            ) : null}

            {panels.length > 0 ? (
                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    {panels.map(({ id, Component }) => (
                        <Component key={id} />
                    ))}
                </div>
            ) : null}
        </Container>
    );
}
