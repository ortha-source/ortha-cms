import { defineMessages, useIntl } from 'react-intl';
import { CircleAlert, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, Badge } from '@ortha-cms/design-system';
import type { ChatProposal } from '../../domain/types/chat';

const messages = defineMessages({
    failed: {
        id: 'copilot.proposal.failed',
        defaultMessage: 'Not saved'
    },
    accepted: {
        id: 'copilot.proposal.accepted',
        defaultMessage: 'Saved'
    },
    rejected: {
        id: 'copilot.proposal.rejected',
        defaultMessage: 'Discarded'
    },
    empty: {
        id: 'copilot.proposal.empty',
        defaultMessage: '(empty)'
    },
    before: {
        id: 'copilot.proposal.before',
        defaultMessage: 'Was'
    },
    after: {
        id: 'copilot.proposal.after',
        defaultMessage: 'Now'
    },
    applied: {
        id: 'copilot.proposal.applied',
        defaultMessage: 'This change was saved to your content.'
    },
    notApplied: {
        id: 'copilot.proposal.notApplied',
        defaultMessage: 'Nothing was saved.'
    },
    failedGeneric: {
        id: 'copilot.proposal.failedGeneric',
        defaultMessage:
            'Ortha AI could not make this change, so your content is unchanged. Try asking again.'
    },
    wasRejected: {
        id: 'copilot.proposal.wasRejected',
        defaultMessage: 'This change was discarded.'
    }
});

/**
 * One change the copilot made, with its per-field diff — **a receipt**.
 *
 * It used to be the accept boundary: two buttons, and a decision that had not
 * been taken yet.
 * [ADR-0009](../../../../../../docs/adr/0009-copilot-applies-directly.md)
 * removed the human step, so by the time this renders the write has already
 * happened (or failed). Every word on it is past tense for that reason — a card
 * that still read "Needs your approval" would be describing a step that no
 * longer exists.
 *
 * **Its job is unchanged even though its buttons are gone: be unmistakable
 * about what happened.** With nothing pausing for review, this card is the only
 * place a user learns that their content changed — so "Saved" and "Not saved"
 * are stated in words, not implied by styling, and a failure shows the server's
 * own reason rather than a generic apology.
 *
 * The card lives in the transcript, attached to the turn that produced it,
 * because a change is part of an answer: "here is what I changed". A list
 * elsewhere would make the reply refer to something off-screen, and the reply
 * is where the reasoning is.
 */
export function ProposalCard({ proposal }: { proposal: ChatProposal }) {
    const intl = useIntl();
    // `pending` no longer means "waiting" — nothing waits. It means the apply
    // did not go through.
    const failed = proposal.status === 'pending';

    return (
        <section
            className="border-border bg-card rounded-lg border shadow-sm"
            // Named by its own summary: with several cards in a thread, "Change"
            // repeated four times tells a screen-reader user nothing.
            aria-label={proposal.summary}
        >
            <header className="flex items-start gap-2 px-3 pt-3">
                <Sparkles className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{proposal.summary}</p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                        {proposal.kind}
                    </p>
                </div>
                <StatusBadge status={proposal.status} />
            </header>

            {proposal.changes && proposal.changes.length > 0 && (
                <dl className="mt-3 divide-y border-t">
                    {proposal.changes.map((change) => (
                        <div key={change.field} className="px-3 py-2">
                            <dt className="text-muted-foreground text-[11px] font-medium">
                                {change.label ?? change.field}
                            </dt>
                            <dd className="mt-1 space-y-1 text-xs">
                                {/* `before` is absent on a create — there is
                                    nothing to replace, and printing an invented
                                    "—" would read as a field being cleared. */}
                                {'before' in change && (
                                    <ValueRow
                                        label={intl.formatMessage(
                                            messages.before
                                        )}
                                        value={change.before}
                                        muted
                                    />
                                )}
                                <ValueRow
                                    label={intl.formatMessage(messages.after)}
                                    value={change.after}
                                />
                            </dd>
                        </div>
                    ))}
                </dl>
            )}

            {/* Keyed off the status, not off `error` being present. A row
                reopened from a past thread may carry the failure without the
                message (older rows, or a reason that was never recorded), and a
                card that then showed the diff with no warning would read as
                though the change had gone through. */}
            {failed && (
                <div className="px-3 pt-3">
                    <Alert variant="destructive">
                        <CircleAlert className="size-4" />
                        <AlertDescription>
                            {proposal.error ??
                                intl.formatMessage(messages.failedGeneric)}
                        </AlertDescription>
                    </Alert>
                </div>
            )}

            <footer className="flex items-center gap-2 border-t px-3 py-2">
                <span className="text-muted-foreground text-[11px]">
                    {proposal.status === 'accepted'
                        ? intl.formatMessage(messages.applied)
                        : proposal.status === 'rejected'
                          ? intl.formatMessage(messages.wasRejected)
                          : intl.formatMessage(messages.notApplied)}
                </span>
            </footer>
        </section>
    );
}

function StatusBadge({ status }: { status: ChatProposal['status'] }) {
    const intl = useIntl();
    if (status === 'accepted') {
        return (
            <Badge variant="secondary">
                {intl.formatMessage(messages.accepted)}
            </Badge>
        );
    }
    if (status === 'rejected') {
        return (
            <Badge variant="outline">
                {intl.formatMessage(messages.rejected)}
            </Badge>
        );
    }
    // `destructive`, not the neutral default it had as "pending": a change the
    // user was told about but which never landed is a failure, and the badge is
    // what they read first.
    return (
        <Badge variant="destructive">
            {intl.formatMessage(messages.failed)}
        </Badge>
    );
}

/**
 * One side of a field's diff.
 *
 * Rendered as **text**, never as markup: a proposed value is content the model
 * produced from content the workspace authored, and this card is where a human
 * decides on it — the one place it must be impossible for it to render as
 * anything but characters.
 */
function ValueRow({
    label,
    value,
    muted
}: {
    label: string;
    value: unknown;
    muted?: boolean;
}) {
    const intl = useIntl();
    const empty = value === null || value === undefined || value === '';
    return (
        <div className="flex gap-2">
            <span className="text-muted-foreground w-10 shrink-0 text-[10px] tracking-wide uppercase">
                {label}
            </span>
            <span
                className={[
                    'min-w-0 flex-1 break-words whitespace-pre-wrap',
                    muted ? 'text-muted-foreground line-through' : '',
                    empty ? 'text-muted-foreground italic' : ''
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                {empty ? intl.formatMessage(messages.empty) : display(value)}
            </span>
        </div>
    );
}

/** A value as a person reads it — scalars plain, anything else as JSON. */
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
