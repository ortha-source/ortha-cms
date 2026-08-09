import { defineMessages, useIntl } from 'react-intl';
import { Check, CircleAlert, Sparkles, X } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Badge,
    Button,
    Spinner
} from '@ortha-cms/design-system';
import type { ChatProposal } from '../../domain/types/chat';

const messages = defineMessages({
    pending: {
        id: 'copilot.proposal.pending',
        defaultMessage: 'Needs your approval'
    },
    accepted: {
        id: 'copilot.proposal.accepted',
        defaultMessage: 'Applied'
    },
    rejected: {
        id: 'copilot.proposal.rejected',
        defaultMessage: 'Discarded'
    },
    accept: {
        id: 'copilot.proposal.accept',
        defaultMessage: 'Apply change'
    },
    reject: {
        id: 'copilot.proposal.reject',
        defaultMessage: 'Discard'
    },
    empty: {
        id: 'copilot.proposal.empty',
        defaultMessage: '(empty)'
    },
    before: {
        id: 'copilot.proposal.before',
        defaultMessage: 'Now'
    },
    after: {
        id: 'copilot.proposal.after',
        defaultMessage: 'After'
    },
    nothingYet: {
        id: 'copilot.proposal.nothingYet',
        defaultMessage: 'Nothing has been saved yet.'
    },
    autoApplied: {
        id: 'copilot.proposal.autoApplied',
        defaultMessage:
            'Applied automatically — this workspace trusts this tool.'
    },
    appliedByYou: {
        id: 'copilot.proposal.appliedByYou',
        defaultMessage: 'You applied this change.'
    }
});

/**
 * One proposed change, with its per-field diff and the two buttons that decide
 * it — **the accept boundary, rendered**
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §5).
 *
 * The card lives in the transcript, attached to the turn that produced it,
 * because a proposal is part of an answer: "here is what I would change". A
 * separate review queue elsewhere would make the reply refer to something
 * off-screen, and the reply is where the reasoning is.
 *
 * **Its most important job is being unmistakable about what has and has not
 * happened.** A pending card says so in words, not only in the presence of
 * buttons; an applied one says Applied and drops them. That is the whole point
 * of propose-then-apply, and a card a user reads as "done" while it is still
 * pending would undo it.
 */
export function ProposalCard({
    proposal,
    onDecide
}: {
    proposal: ChatProposal;
    onDecide(decision: 'accept' | 'reject'): void;
}) {
    const intl = useIntl();
    const pending = proposal.status === 'pending';
    const busy = proposal.deciding === true;

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

            {proposal.error && (
                <div className="px-3 pt-3">
                    <Alert variant="destructive">
                        <CircleAlert className="size-4" />
                        <AlertDescription>{proposal.error}</AlertDescription>
                    </Alert>
                </div>
            )}

            <footer className="flex items-center gap-2 border-t px-3 py-2">
                {pending ? (
                    <>
                        <span className="text-muted-foreground mr-auto text-[11px]">
                            {intl.formatMessage(messages.nothingYet)}
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => onDecide('reject')}
                        >
                            <X className="size-3.5" />
                            {intl.formatMessage(messages.reject)}
                        </Button>
                        <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => onDecide('accept')}
                        >
                            {busy ? (
                                <Spinner className="size-3.5" />
                            ) : (
                                <Check className="size-3.5" />
                            )}
                            {intl.formatMessage(messages.accept)}
                        </Button>
                    </>
                ) : (
                    <span className="text-muted-foreground text-[11px]">
                        {proposal.status !== 'accepted'
                            ? intl.formatMessage(messages.rejected)
                            : proposal.autoApplied
                              ? intl.formatMessage(messages.autoApplied)
                              : intl.formatMessage(messages.appliedByYou)}
                    </span>
                )}
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
    return <Badge>{intl.formatMessage(messages.pending)}</Badge>;
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
