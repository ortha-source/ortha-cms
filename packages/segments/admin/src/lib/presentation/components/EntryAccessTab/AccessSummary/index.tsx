import { defineMessages, useIntl } from 'react-intl';
import type { EntryAccess, Segment } from '../../../../domain/types';

const messages = defineMessages({
    everyone: {
        id: 'segments.summary.everyone',
        defaultMessage: 'Readable by everyone.'
    },
    everyoneExcept: {
        id: 'segments.summary.everyoneExcept',
        defaultMessage: 'Readable by everyone except {deny}.'
    },
    only: {
        id: 'segments.summary.only',
        defaultMessage: 'Readable only by {allow}.'
    },
    onlyExcept: {
        id: 'segments.summary.onlyExcept',
        defaultMessage: 'Readable only by {allow} — never by {deny}.'
    },
    others: {
        id: 'segments.summary.others',
        defaultMessage:
            '{count, plural, one {# other audience} other {# other audiences}}'
    }
});

/**
 * The Access tab's lead: who can read the record, **in one sentence** —
 * "Readable by everyone except Trial users" — before the table that decides
 * it. The rule it states is the model's own: nothing allowed means everyone,
 * anything allowed means only those, and a "Cannot see" always wins.
 *
 * Audiences are named when the list on screen knows them; the rest are
 * counted, never left out, since a sentence that dropped one would describe a
 * different record.
 */
export function AccessSummary({
    access,
    known
}: {
    /** The access as it will be saved (staged edits included). */
    access: EntryAccess;
    /** The audiences the tab has loaded, to name ids with. */
    known: Segment[];
}) {
    const intl = useIntl();
    const labels = new Map(known.map((segment) => [segment.id, segment.label]));
    const names = (ids: string[]) => {
        const named = ids.flatMap((id) => {
            const label = labels.get(id);
            return label ? [label] : [];
        });
        const unnamed = ids.length - named.length;
        return intl.formatList(
            unnamed > 0
                ? [
                      ...named,
                      intl.formatMessage(messages.others, { count: unnamed })
                  ]
                : named,
            { type: 'conjunction' }
        );
    };
    const { allow, deny } = access;
    const sentence =
        allow.length === 0
            ? deny.length === 0
                ? intl.formatMessage(messages.everyone)
                : intl.formatMessage(messages.everyoneExcept, {
                      deny: names(deny)
                  })
            : deny.length === 0
              ? intl.formatMessage(messages.only, { allow: names(allow) })
              : intl.formatMessage(messages.onlyExcept, {
                    allow: names(allow),
                    deny: names(deny)
                });
    return (
        <p data-testid="access-summary" className="text-sm">
            {sentence}
        </p>
    );
}
