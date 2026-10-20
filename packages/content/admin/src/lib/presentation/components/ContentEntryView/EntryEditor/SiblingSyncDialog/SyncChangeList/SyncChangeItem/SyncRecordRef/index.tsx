import { defineMessages, useIntl } from 'react-intl';
import { ExternalLink, Minus, Plus } from 'lucide-react';
import { Badge, buttonVariants, cn } from '@orthacms/design-system';
import type { RelationRef } from '../../../../../../../../domain/types/contentType';
import { ENTRY_STATUS } from '../../../../../../../../domain/constants';
import { TrashedBadge } from '../../../../../../TrashedBadge';

const messages = defineMessages({
    added: {
        id: 'content.editor.siblingSync.ref.added',
        defaultMessage: 'Will be linked:'
    },
    removed: {
        id: 'content.editor.siblingSync.ref.removed',
        defaultMessage: 'Will be unlinked:'
    },
    unavailable: {
        id: 'content.editor.siblingSync.ref.unavailable',
        defaultMessage: 'Unavailable record'
    },
    statusDraft: {
        id: 'content.editor.siblingSync.ref.statusDraft',
        defaultMessage: 'Draft'
    },
    statusPublished: {
        id: 'content.editor.siblingSync.ref.statusPublished',
        defaultMessage: 'Published'
    },
    open: {
        id: 'content.editor.siblingSync.ref.open',
        defaultMessage: 'Open {title} in a new tab'
    }
});

/** Which way a link moves — picks the glyph and what is announced. */
export const SYNC_REF_CHANGE = {
    Added: 'added',
    Removed: 'removed'
} as const;

/** @see SYNC_REF_CHANGE */
export type SyncRefChange =
    (typeof SYNC_REF_CHANGE)[keyof typeof SYNC_REF_CHANGE];

/** Props for {@link SyncRecordRef}. */
export type SyncRecordRefProps = {
    record: RelationRef;
    change: SyncRefChange;
    /** The record's own editor, when its type is known. */
    href?: string;
};

/**
 * One linked record gained or lost in the sync preview — the same row a
 * relation shows in the editor, reduced: a `+`/`−` glyph (spoken as "Will be
 * linked:" / "Will be unlinked:"), the record's title, its publish status,
 * and a link opening it in a new tab, so a person can check what they are
 * about to link before confirming.
 *
 * A record that no longer resolves reads "Unavailable record" and carries no
 * link, and one in the trash keeps its title beside the "In trash" mark —
 * the same rules `RelationItemRow` follows.
 */
export function SyncRecordRef({ record, change, href }: SyncRecordRefProps) {
    const intl = useIntl();
    const added = change === SYNC_REF_CHANGE.Added;
    const Glyph = added ? Plus : Minus;
    const title = record.missing
        ? intl.formatMessage(messages.unavailable)
        : record.title;
    const live = !record.missing && !record.trashed;

    return (
        <li className="flex min-w-0 items-center gap-2">
            <Glyph
                aria-hidden
                className={cn(
                    'size-3.5 shrink-0',
                    added ? 'text-success-soft-foreground' : 'text-destructive'
                )}
            />
            <span className="sr-only">
                {intl.formatMessage(
                    added ? messages.added : messages.removed
                )}{' '}
            </span>
            <span
                className={cn(
                    'min-w-0 truncate text-foreground',
                    !added && 'line-through decoration-muted-foreground/60',
                    record.missing && 'italic text-muted-foreground'
                )}
            >
                {title}
            </span>
            {record.trashed ? <TrashedBadge /> : null}
            {record.status && live ? (
                <Badge
                    variant={
                        record.status === ENTRY_STATUS.Published
                            ? 'success'
                            : 'secondary'
                    }
                    className="shrink-0"
                >
                    {intl.formatMessage(
                        record.status === ENTRY_STATUS.Published
                            ? messages.statusPublished
                            : messages.statusDraft
                    )}
                </Badge>
            ) : null}
            {href && live ? (
                <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-6 shrink-0 text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={intl.formatMessage(messages.open, { title })}
                >
                    <ExternalLink className="size-3.5" aria-hidden />
                </a>
            ) : null}
        </li>
    );
}
