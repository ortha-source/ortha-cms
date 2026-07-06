import { defineMessages, useIntl } from 'react-intl';
import { Check, Plus } from 'lucide-react';
import { Badge, cn } from '@ortha-cms/design-system';
import type { EntryStatus } from '@ortha-cms/content-admin';

const messages = defineMessages({
    add: { id: 'i18n.widget.add', defaultMessage: 'Add' },
    statusPublished: {
        id: 'i18n.widget.status.published',
        defaultMessage: 'Published'
    },
    statusDraft: { id: 'i18n.widget.status.draft', defaultMessage: 'Draft' },
    switchLabel: {
        id: 'i18n.widget.switchLabel',
        defaultMessage: 'Switch to the {name} version'
    },
    addLabel: {
        id: 'i18n.widget.addLabel',
        defaultMessage: 'Create the {name} translation'
    }
});

/**
 * One locale's row in the {@link LocaleWidget} switcher. The current locale is
 * marked; an **existing** sibling is a switch target (with its publish status);
 * a **missing** locale is dimmed but selectable to re-target the form to it.
 * The whole row is the switch affordance — a single `<button>` when actionable,
 * otherwise a static (current) or inert (no permission) row.
 */
export function LocaleRow({
    name,
    isCurrent,
    exists,
    status,
    onSelect
}: {
    /** Display name of the locale. */
    name: string;
    /** Whether this is the locale the editor currently has open. */
    isCurrent: boolean;
    /** Whether a translation exists in this locale. */
    exists: boolean;
    /** The sibling row's publish status (publishable types only). */
    status?: EntryStatus;
    /** Switch to / create this locale. Absent = not actionable. */
    onSelect?: () => void;
}) {
    const intl = useIntl();
    const missing = !exists && !isCurrent;

    const body = (
        <>
            <span
                className={cn(
                    'flex min-w-0 items-center gap-2',
                    missing && 'text-muted-foreground'
                )}
            >
                {isCurrent ? (
                    <Check aria-hidden className="size-3.5 shrink-0" />
                ) : (
                    <span aria-hidden className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
                {status ? (
                    <Badge
                        variant={
                            status === 'published' ? 'default' : 'secondary'
                        }
                    >
                        {intl.formatMessage(
                            status === 'published'
                                ? messages.statusPublished
                                : messages.statusDraft
                        )}
                    </Badge>
                ) : null}
                {missing && onSelect ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Plus aria-hidden className="size-3" />
                        {intl.formatMessage(messages.add)}
                    </span>
                ) : null}
            </span>
        </>
    );

    const rowClass =
        'flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 text-sm';

    // Actionable rows are a single full-width button (the whole row switches).
    if (onSelect && !isCurrent) {
        return (
            <li>
                <button
                    type="button"
                    onClick={onSelect}
                    aria-label={intl.formatMessage(
                        exists ? messages.switchLabel : messages.addLabel,
                        { name }
                    )}
                    className={cn(
                        rowClass,
                        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    )}
                >
                    {body}
                </button>
            </li>
        );
    }

    // Current (highlighted) or non-actionable (no create permission) — static.
    return (
        <li
            aria-current={isCurrent ? 'true' : undefined}
            className={cn(
                rowClass,
                isCurrent && 'bg-accent',
                !isCurrent && 'opacity-50'
            )}
        >
            {body}
        </li>
    );
}
