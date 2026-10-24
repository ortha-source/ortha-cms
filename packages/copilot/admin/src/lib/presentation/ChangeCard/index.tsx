import { useState, type ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Pencil } from 'lucide-react';
import { Badge, cn } from '@orthacms/design-system';
import { groupChanges, type ChangeRow } from './groupChanges';

const messages = defineMessages({
    count: {
        id: 'copilot.change.count',
        defaultMessage: '{count, plural, one {# change} other {# changes}}'
    },
    preview: {
        id: 'copilot.change.preview',
        defaultMessage: 'Not saved'
    },
    accepted: {
        id: 'copilot.proposal.accepted',
        defaultMessage: 'Saved'
    },
    failed: {
        id: 'copilot.proposal.failed',
        defaultMessage: 'Not saved'
    },
    rejected: {
        id: 'copilot.proposal.rejected',
        defaultMessage: 'Discarded'
    },
    showAll: {
        id: 'copilot.change.showAll',
        defaultMessage: 'Show all'
    },
    showFewer: {
        id: 'copilot.change.showFewer',
        defaultMessage: 'Show fewer'
    },
    omitted: {
        id: 'copilot.change.omitted',
        defaultMessage:
            '{count, plural, one {# more change is} other {# more changes are}} not shown here.'
    },
    empty: {
        id: 'copilot.proposal.empty',
        defaultMessage: 'empty'
    },
    becomes: {
        id: 'copilot.change.becomes',
        defaultMessage: 'becomes'
    },
    was: {
        id: 'copilot.change.was',
        defaultMessage: 'was'
    }
});

/** How many records the card lists before "Show all". */
const COLLAPSED_RECORDS = 3;

/** What the card is a picture of. */
export type ChangeCardStatus =
    /** Asked about, not yet made — the permission prompt's preview. */
    | 'preview'
    /** Made. */
    | 'accepted'
    /** Tried and failed (ADR-0009's reading of `pending`). */
    | 'pending'
    /** Discarded — only on rows written before ADR-0009. */
    | 'rejected';

export interface ChangeCardProps {
    /** The tool's one line for a person; also the card's accessible name. */
    summary: string;
    /** Per-field before/after, in the order the tool produced them. */
    changes: readonly ChangeRow[];
    /** Where in its life the change is. */
    status: ChangeCardStatus;
    /** How many records the change touches, when the server counted them. */
    records?: number;
    /** Changes the server left out of {@link changes}, for a preview. */
    omitted?: number;
    /** Below the rows: a failure's reason, a receipt's footer. */
    children?: ReactNode;
    className?: string;
}

/**
 * **A change, as "Was → Now" per record** (R7, `AiConversation`) — one card for
 * both moments a person reads a change: the permission prompt's preview,
 * marked *Not saved*, and the receipt afterwards, marked *Saved*.
 *
 * It used to be two shapes: a receipt card listing `Was` / `Now` rows per
 * field, and a prompt that showed the call's arguments as JSON. The rows are
 * now grouped **under the record they belong to** (`groupChanges` — the
 * binder's `record`, or the batch position), each reading
 * `Summary · ~~empty~~ → Everything that shipped…`; past three records the rest
 * fold behind "Show all".
 *
 * Every value renders as **text**, never markup: this card is what tells a
 * person what was — or would be — written to their content, and the values
 * are model-authored.
 */
export function ChangeCard({
    summary,
    changes,
    status,
    records,
    omitted = 0,
    children,
    className
}: ChangeCardProps) {
    const intl = useIntl();
    const [expanded, setExpanded] = useState(false);
    const groups = groupChanges(changes);
    const count = records ?? Math.max(groups.length, 1);
    const visible = expanded ? groups : groups.slice(0, COLLAPSED_RECORDS);
    const folded = groups.length > COLLAPSED_RECORDS;

    return (
        <section
            aria-label={summary}
            className={cn(
                'bg-card overflow-hidden rounded-xl border text-[13px]',
                className
            )}
        >
            <header className="bg-muted/40 flex items-center gap-2 border-b px-3.5 py-2.5">
                <Pencil aria-hidden className="size-4 shrink-0" />
                <span className="font-semibold">
                    {intl.formatMessage(messages.count, { count })}
                </span>
                <StatusBadge status={status} />
                {folded ? (
                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        aria-expanded={expanded}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring ml-auto rounded-sm text-xs underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
                    >
                        {intl.formatMessage(
                            expanded ? messages.showFewer : messages.showAll
                        )}
                    </button>
                ) : null}
            </header>

            {/* The tool's own sentence. Kept on the card, not only in its
                name, because a binder writes more than a title into it — a
                write that also rewrites a record's other languages says so
                here, and that is the line a reader must not miss. */}
            <p className="text-muted-foreground border-b px-3.5 py-2 text-xs">
                {summary}
            </p>

            {visible.length > 0 ? (
                <ul className="divide-y">
                    {visible.map((group) => (
                        <li
                            key={group.key}
                            className="flex flex-col gap-1 px-3.5 py-2.5"
                        >
                            {group.record ? (
                                <span className="font-medium">
                                    {group.record}
                                </span>
                            ) : null}
                            {group.changes.map((change) => (
                                <ChangeLine
                                    key={change.field}
                                    change={change}
                                />
                            ))}
                        </li>
                    ))}
                </ul>
            ) : null}

            {omitted > 0 && (expanded || !folded) ? (
                <p className="text-muted-foreground border-t px-3.5 py-2 text-xs">
                    {intl.formatMessage(messages.omitted, { count: omitted })}
                </p>
            ) : null}

            {children}
        </section>
    );
}

/** `Summary · ~~was~~ → now`, as one line that wraps. */
function ChangeLine({ change }: { change: ChangeRow }) {
    const intl = useIntl();
    const hasBefore = 'before' in change;
    return (
        <p className="min-w-0 break-words whitespace-pre-wrap">
            <span className="text-muted-foreground">
                {change.label ?? change.field} ·{' '}
            </span>
            {/* `before` is absent on a create — there is nothing to replace,
                and an invented "empty" would read as a field being cleared. */}
            {hasBefore ? (
                <>
                    <span className="sr-only">
                        {intl.formatMessage(messages.was)}{' '}
                    </span>
                    <Value value={change.before} struck />
                    <span aria-hidden> → </span>
                    <span className="sr-only">
                        {' '}
                        {intl.formatMessage(messages.becomes)}{' '}
                    </span>
                </>
            ) : null}
            <Value value={change.after} />
        </p>
    );
}

/** One value as text — never markup. */
function Value({ value, struck }: { value: unknown; struck?: boolean }) {
    const intl = useIntl();
    const empty = value === null || value === undefined || value === '';
    return (
        <span
            className={cn(
                struck
                    ? 'text-muted-foreground line-through'
                    : 'text-foreground',
                empty && !struck && 'text-muted-foreground italic'
            )}
        >
            {empty ? intl.formatMessage(messages.empty) : display(value)}
        </span>
    );
}

function StatusBadge({ status }: { status: ChangeCardStatus }) {
    const intl = useIntl();
    switch (status) {
        case 'preview':
            return (
                <Badge variant="warning" size="xs">
                    {intl.formatMessage(messages.preview)}
                </Badge>
            );
        case 'accepted':
            return (
                <Badge variant="success" size="xs">
                    {intl.formatMessage(messages.accepted)}
                </Badge>
            );
        case 'rejected':
            return (
                <Badge variant="line" size="xs">
                    {intl.formatMessage(messages.rejected)}
                </Badge>
            );
        case 'pending':
            return (
                <Badge variant="destructive" size="xs">
                    {intl.formatMessage(messages.failed)}
                </Badge>
            );
    }
}

/**
 * A value as a person reads it. Strings verbatim, scalars as written, anything
 * structured as compact JSON — still text, never interpreted.
 */
function display(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    try {
        return JSON.stringify(value) ?? '';
    } catch {
        return String(value);
    }
}
