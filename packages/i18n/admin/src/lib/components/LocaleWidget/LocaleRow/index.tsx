import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { Badge, Button, Spinner } from '@ortha-cms/design-system';
import type { EntryStatus } from '@ortha-cms/content-admin';

const messages = defineMessages({
    current: { id: 'i18n.widget.current', defaultMessage: 'Current' },
    open: { id: 'i18n.widget.open', defaultMessage: 'Open' },
    add: { id: 'i18n.widget.add', defaultMessage: 'Add' },
    missing: { id: 'i18n.widget.missing', defaultMessage: 'Not translated' },
    statusPublished: {
        id: 'i18n.widget.status.published',
        defaultMessage: 'Published'
    },
    statusDraft: { id: 'i18n.widget.status.draft', defaultMessage: 'Draft' },
    openLabel: {
        id: 'i18n.widget.openLabel',
        defaultMessage: 'Open the {name} version'
    },
    addLabel: {
        id: 'i18n.widget.addLabel',
        defaultMessage: 'Create the {name} translation'
    }
});

/**
 * One locale's row in the {@link LocaleWidget}: name + per-locale publish
 * status, and the action its state affords — nothing when it's the open row,
 * **Open** when the translation exists, **Create translation** when missing
 * (permission-gated by the widget).
 */
export function LocaleRow({
    name,
    isCurrent,
    exists,
    status,
    creating = false,
    onOpen,
    onCreate
}: {
    /** Display name of the locale. */
    name: string;
    /** Whether this is the row the editor has open. */
    isCurrent: boolean;
    /** Whether the translation exists. */
    exists: boolean;
    /** The sibling row's publish status (publishable types only). */
    status?: EntryStatus;
    /** Whether a create-translation for this locale is in flight. */
    creating?: boolean;
    /** Navigate to the sibling row (when it exists and isn't current). */
    onOpen?: () => void;
    /** Create the missing translation (when permitted). */
    onCreate?: () => void;
}) {
    const intl = useIntl();
    return (
        <li className="flex min-h-9 items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{name}</span>
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
            </span>
            {isCurrent ? (
                <Badge variant="outline">
                    {intl.formatMessage(messages.current)}
                </Badge>
            ) : exists ? (
                onOpen ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onOpen}
                        aria-label={intl.formatMessage(messages.openLabel, {
                            name
                        })}
                    >
                        {intl.formatMessage(messages.open)}
                    </Button>
                ) : null
            ) : onCreate ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={creating}
                    onClick={onCreate}
                    aria-label={intl.formatMessage(messages.addLabel, { name })}
                >
                    {creating ? (
                        <Spinner aria-hidden className="size-3.5" />
                    ) : (
                        <Plus aria-hidden className="size-3.5" />
                    )}
                    {intl.formatMessage(messages.add)}
                </Button>
            ) : (
                <span className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.missing)}
                </span>
            )}
        </li>
    );
}
