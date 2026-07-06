import { defineMessages, useIntl } from 'react-intl';
import { Check } from 'lucide-react';
import { Badge, cn } from '@ortha-cms/design-system';
import type { RecordLocale } from '../../../../types/recordDraft';

const messages = defineMessages({
    title: { id: 'content.record.locale.title', defaultMessage: 'Locale' },
    helper: {
        id: 'content.record.locale.helper',
        defaultMessage:
            "Switch between this record's locales, or start a new translation."
    },
    add: { id: 'content.record.locale.add', defaultMessage: '+ Add' },
    statusDraft: {
        id: 'content.record.locale.statusDraft',
        defaultMessage: 'Draft'
    },
    statusPublished: {
        id: 'content.record.locale.statusPublished',
        defaultMessage: 'Published'
    },
    switchAria: {
        id: 'content.record.locale.switchAria',
        defaultMessage: 'Edit the {label} translation'
    }
});

/**
 * The **Locale** widget: one row per translation slot. The active locale reads
 * as selected (accent fill + leading check); the others show a Draft/Published
 * badge, or a "+ Add" affordance when the translation hasn't been started.
 * Selecting a locale switches the edited translation (a route change upstream).
 */
export function LocaleWidget({
    locales,
    activeCode,
    onSwitch
}: {
    locales: RecordLocale[];
    activeCode: string;
    onSwitch: (code: string) => void;
}) {
    const intl = useIntl();
    return (
        <section className="rounded-2xl border bg-background p-[18px]">
            <h2 className="text-[13px] font-medium text-muted-foreground">
                {intl.formatMessage(messages.title)}
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
                {intl.formatMessage(messages.helper)}
            </p>

            <ul className="mt-3 flex flex-col gap-1">
                {locales.map((locale) => {
                    const active = locale.code === activeCode;
                    return (
                        <li key={locale.code}>
                            <button
                                type="button"
                                onClick={() => onSwitch(locale.code)}
                                aria-current={active || undefined}
                                aria-label={intl.formatMessage(
                                    messages.switchAria,
                                    { label: locale.label }
                                )}
                                className={cn(
                                    'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                                    active
                                        ? 'bg-accent font-medium'
                                        : 'hover:bg-accent/60'
                                )}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    {active ? (
                                        <Check
                                            className="size-4 shrink-0"
                                            aria-hidden
                                        />
                                    ) : (
                                        <span
                                            className="size-4 shrink-0"
                                            aria-hidden
                                        />
                                    )}
                                    <span className="truncate">
                                        {locale.label}
                                    </span>
                                </span>
                                {locale.status === null ? (
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {intl.formatMessage(messages.add)}
                                    </span>
                                ) : (
                                    <Badge
                                        variant="secondary"
                                        className="shrink-0 text-[11px] font-medium"
                                    >
                                        {intl.formatMessage(
                                            locale.status === 'published'
                                                ? messages.statusPublished
                                                : messages.statusDraft
                                        )}
                                    </Badge>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
