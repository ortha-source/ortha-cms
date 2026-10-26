import { defineMessages, useIntl } from 'react-intl';
import type { EntryChanges } from '../../../domain/types';

const messages = defineMessages({
    untitled: {
        id: 'protection.queue.untitled',
        defaultMessage: 'Record {entry}'
    },
    changed: {
        id: 'protection.queue.fieldsChanged',
        defaultMessage:
            '{count, plural, =0 {no changes since it was live} one {# field changed} other {# fields changed}}'
    }
});

/** A record's display name — its title, or a fragment of its id. */
export function useRecordName() {
    const intl = useIntl();
    return (item: { entryTitle: string | null; entryId: string }) =>
        item.entryTitle ??
        intl.formatMessage(messages.untitled, {
            entry: item.entryId.slice(0, 8)
        });
}

/**
 * A queue line's first cell: the record's title over its type and how much
 * changed since it was live — "Articles · 3 fields changed" — so a reviewer
 * can tell a typo from a rewrite before opening anything.
 *
 * A count the server could not compute is left out rather than shown as zero:
 * "no changes" is a claim. A record with no title falls back to a fragment of
 * its id.
 */
export function RecordSummary({
    item
}: {
    item: {
        entryId: string;
        entryTitle: string | null;
        contentTypeLabel: string;
    } & Pick<EntryChanges, 'fieldsChanged'>;
}) {
    const intl = useIntl();
    const name = useRecordName();
    return (
        <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{name(item)}</span>
            <span className="truncate text-xs text-muted-foreground">
                {item.contentTypeLabel}
                {item.fieldsChanged != null
                    ? ` · ${intl.formatMessage(messages.changed, {
                          count: item.fieldsChanged
                      })}`
                    : null}
            </span>
        </div>
    );
}
