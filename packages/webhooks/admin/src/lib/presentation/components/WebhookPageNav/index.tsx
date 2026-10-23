import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';

const messages = defineMessages({
    title: { id: 'webhooks.pageNav.title', defaultMessage: 'On this page' }
});

/** One entry of {@link WebhookPageNav}. */
export type WebhookPageNavItem = { id: string; label: string };

/**
 * "On this page" beside the webhook editor: one link per section, the one in
 * view marked. A pick scrolls the section into view and moves focus to its
 * heading, so a keyboard lands where the eye does.
 */
export function WebhookPageNav({ items }: { items: WebhookPageNavItem[] }) {
    const intl = useIntl();
    const [current, setCurrent] = useState(items[0]?.id);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (a, b) =>
                            a.boundingClientRect.top - b.boundingClientRect.top
                    );
                if (visible[0]) setCurrent(visible[0].target.id);
            },
            { rootMargin: '0px 0px -60% 0px' }
        );
        for (const item of items) {
            const element = document.getElementById(item.id);
            if (element) observer.observe(element);
        }
        return () => observer.disconnect();
    }, [items]);

    return (
        <nav
            aria-label={intl.formatMessage(messages.title)}
            className="sticky top-6 flex flex-col gap-0.5"
        >
            <p className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground">
                {intl.formatMessage(messages.title)}
            </p>
            {items.map((item) => (
                <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={current === item.id ? 'true' : undefined}
                    onClick={(event) => {
                        event.preventDefault();
                        const section = document.getElementById(item.id);
                        section?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                        const heading = document.getElementById(
                            `${item.id}-title`
                        );
                        heading?.setAttribute('tabindex', '-1');
                        heading?.focus({ preventScroll: true });
                        setCurrent(item.id);
                    }}
                    className={cn(
                        'rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        current === item.id &&
                            'bg-muted font-medium text-foreground'
                    )}
                >
                    {item.label}
                </a>
            ))}
        </nav>
    );
}
