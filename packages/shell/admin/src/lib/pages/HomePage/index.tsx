import { defineMessages, useIntl } from 'react-intl';
import { Home as HomeIcon } from 'lucide-react';
import { useAuth } from '@orthacms/identity-admin';
import { byOrder, useDocumentTitle } from '@orthacms/utils-admin';
import { HOME_SECTION_SLOT } from '../../slots/homeSlots';
import { PageTopBar } from '../../components/PageTopBar';
import { PageActionsPortal } from '../../utils/pageChrome';

const messages = defineMessages({
    documentTitle: {
        id: 'shell.home.documentTitle',
        defaultMessage: 'Home'
    },
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
    attention: {
        id: 'shell.home.attention',
        defaultMessage: 'Needs your attention'
    },
    overview: {
        id: 'shell.home.overview',
        defaultMessage: 'Overview'
    }
});

function greetingFor(hour: number) {
    if (hour < 12) return messages.greetingMorning;
    if (hour < 18) return messages.greetingAfternoon;
    return messages.greetingEvening;
}

/**
 * The signed-in landing page, built from `HOME_SECTION_SLOT`: the top bar's
 * actions, "Needs your attention" (cards a plugin renders only while
 * something is stuck), the overview tiles, and the panels.
 *
 * It renders a top bar like every other page, so the floating sidebar toggle
 * stands down here too and the reveal trigger sits in the bar.
 */
export function HomePage() {
    const intl = useIntl();
    // Names this route in the tab strip, the window list, the history
    // and a screen reader's window announcement. Every private route but
    // Workspaces was still titled a bare "Admin" (WCAG 2.4.2, `ORT-140`).
    useDocumentTitle(intl.formatMessage(messages.documentTitle));
    const { user } = useAuth();
    const now = new Date();
    const greeting = greetingFor(now.getHours());

    const sections = byOrder(HOME_SECTION_SLOT.getItems());
    const of = (region: string) =>
        sections.filter((section) => section.region === region);
    const actions = of('action');
    const attention = of('attention');
    const stats = of('stat');
    const panels = of('panel');

    return (
        <>
            <PageTopBar
                icon={HomeIcon}
                crumbs={[
                    {
                        key: 'home',
                        label: intl.formatMessage(messages.documentTitle)
                    }
                ]}
            />
            {actions.length > 0 ? (
                <PageActionsPortal>
                    {actions.map(({ id, Component }) => (
                        <Component key={id} />
                    ))}
                </PageActionsPortal>
            ) : null}
            <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-7 px-4 py-8 sm:px-10">
                <header className="flex flex-col gap-1.5">
                    <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.012em]">
                        {intl.formatMessage(greeting, {
                            name: user?.name ?? user?.email ?? ''
                        })}
                    </h1>
                    <p className="text-[13px] leading-[18px] text-muted-foreground">
                        {intl.formatDate(now, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </p>
                </header>

                {attention.length > 0 ? (
                    // Hidden while every card renders nothing: the heading
                    // over an empty grid would announce a problem there is
                    // none of.
                    <section
                        aria-labelledby="home-attention"
                        className="flex flex-col gap-3 has-[[data-home-attention]:empty]:hidden"
                    >
                        <h2
                            id="home-attention"
                            className="text-[15px] font-semibold leading-5"
                        >
                            {intl.formatMessage(messages.attention)}
                        </h2>
                        <div
                            data-home-attention
                            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                        >
                            {attention.map(({ id, Component }) => (
                                <Component key={id} />
                            ))}
                        </div>
                    </section>
                ) : null}

                {stats.length > 0 ? (
                    <section
                        aria-labelledby="home-overview"
                        className="flex flex-col gap-3"
                    >
                        <h2
                            id="home-overview"
                            className="text-[15px] font-semibold leading-5"
                        >
                            {intl.formatMessage(messages.overview)}
                        </h2>
                        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                            {stats.map(({ id, Component }) => (
                                <Component key={id} />
                            ))}
                        </div>
                    </section>
                ) : null}

                {panels.length > 0 ? (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                        {panels.map(({ id, Component }) => (
                            <Component key={id} />
                        ))}
                    </div>
                ) : null}
            </div>
        </>
    );
}
