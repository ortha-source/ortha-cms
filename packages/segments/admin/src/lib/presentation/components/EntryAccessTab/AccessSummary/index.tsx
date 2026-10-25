import { Children, useId, useState, type ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import type { EntryAccess, Segment } from '../../../../domain/types';

const messages = defineMessages({
    everyone: {
        id: 'segments.summary.everyone',
        defaultMessage: 'Readable by everyone'
    },
    everyoneExcept: {
        id: 'segments.summary.everyoneExcept',
        defaultMessage: 'Readable by everyone except {deny}'
    },
    only: {
        id: 'segments.summary.only',
        defaultMessage: 'Readable only by {allow}'
    },
    onlyExcept: {
        id: 'segments.summary.onlyExcept',
        defaultMessage: 'Readable only by {allow} — never by {deny}'
    },
    others: {
        id: 'segments.summary.others',
        defaultMessage:
            '{count, plural, one {# other audience} other {# other audiences}}'
    },
    more: {
        id: 'segments.summary.more',
        defaultMessage: 'and {count} more'
    },
    canSee: {
        id: 'segments.summary.canSee',
        defaultMessage: 'Can see: {names}'
    },
    cannotSee: {
        id: 'segments.summary.cannotSee',
        defaultMessage: 'Cannot see: {names}'
    }
});

/** Names said in the sentence, per side, before the rest are counted. */
export const SUMMARY_NAMED = 3;

/** One side of the sentence: its labels, sorted, and the ids left unnamed. */
type Side = { named: string[]; unnamed: number };

/**
 * The Access tab's lead: who can read the record, **in one sentence** —
 * "Readable by everyone except Trial users" — before the table that decides
 * it. The rule it states is the model's own: nothing allowed means everyone,
 * anything allowed means only those, and a "Cannot see" always wins.
 *
 * **Compact, whatever the count.** Each side names at most three audiences
 * (alphabetically) and counts the rest — "Readable only by A, B, C and 5 more —
 * never by D and 4 more" — because thirty names made the lead a paragraph
 * nobody read. "and N more" is a disclosure: it opens the full lists under the
 * sentence ("Can see: …" / "Cannot see: …"); both sides' buttons drive the one
 * region.
 *
 * Audiences are named when the tab knows them; the rest are counted, never
 * left out, since a sentence that dropped one would describe a different
 * record.
 */
export function AccessSummary({
    access,
    known,
    headingId
}: {
    /** The access as it will be saved (staged edits included). */
    access: EntryAccess;
    /** The audiences the tab knows, to name ids with. */
    known: Segment[];
    /** The sentence's id — what the summary card is labelled by. */
    headingId?: string;
}) {
    const intl = useIntl();
    const regionId = useId();
    const [open, setOpen] = useState(false);
    const labels = new Map(known.map((segment) => [segment.id, segment.label]));

    const side = (ids: string[]): Side => {
        const named = ids
            .flatMap((id) => {
                const label = labels.get(id);
                return label ? [label] : [];
            })
            .sort((a, b) => a.localeCompare(b));
        return { named, unnamed: ids.length - named.length };
    };

    /** The whole side, as the disclosure (and a short side) says it. */
    const full = ({ named, unnamed }: Side) =>
        intl.formatList(
            unnamed > 0
                ? [
                      ...named,
                      intl.formatMessage(messages.others, { count: unnamed })
                  ]
                : named,
            { type: 'conjunction' }
        );

    /** "A, B, C and 5 more" — the "more" being the disclosure's button. */
    const compact = (list: Side): ReactNode => {
        if (list.named.length <= SUMMARY_NAMED) return full(list);
        const rest = list.named.length - SUMMARY_NAMED + list.unnamed;
        return (
            <>
                {intl.formatList(list.named.slice(0, SUMMARY_NAMED), {
                    type: 'unit',
                    style: 'short'
                })}{' '}
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={regionId}
                    onClick={() => setOpen((value) => !value)}
                    className="rounded-sm font-semibold underline decoration-muted-foreground/60 underline-offset-2 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {intl.formatMessage(messages.more, { count: rest })}
                </button>
            </>
        );
    };

    const allow = side(access.allow);
    const deny = side(access.deny);
    const sentence =
        access.allow.length === 0
            ? access.deny.length === 0
                ? intl.formatMessage(messages.everyone)
                : intl.formatMessage(messages.everyoneExcept, {
                      deny: compact(deny)
                  })
            : access.deny.length === 0
              ? intl.formatMessage(messages.only, { allow: compact(allow) })
              : intl.formatMessage(messages.onlyExcept, {
                    allow: compact(allow),
                    deny: compact(deny)
                });
    const collapsible =
        allow.named.length > SUMMARY_NAMED || deny.named.length > SUMMARY_NAMED;

    return (
        <>
            <h2
                id={headingId}
                data-testid="access-summary"
                className="text-[15px] font-semibold leading-5"
            >
                {Children.toArray(sentence)}
            </h2>
            {collapsible && open ? (
                <div
                    id={regionId}
                    data-testid="access-summary-full"
                    className="mt-1 flex flex-col gap-0.5 text-[13px] leading-[18px] text-foreground"
                >
                    {access.allow.length ? (
                        <p>
                            {intl.formatMessage(messages.canSee, {
                                names: full(allow)
                            })}
                        </p>
                    ) : null}
                    {access.deny.length ? (
                        <p>
                            {intl.formatMessage(messages.cannotSee, {
                                names: full(deny)
                            })}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </>
    );
}
