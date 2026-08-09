import { defineMessages, useIntl } from 'react-intl';
import { Check, X } from 'lucide-react';
import { Button, Spinner } from '@ortha-cms/design-system';
import type { BulkDecision } from '../../application/useCopilotChat';

const messages = defineMessages({
    waiting: {
        id: 'copilot.proposals.waiting',
        defaultMessage:
            '{count, plural, one {# change needs your approval} other {# changes need your approval}}'
    },
    applyAll: {
        id: 'copilot.proposals.applyAll',
        defaultMessage: 'Apply all {count}'
    },
    discardAll: {
        id: 'copilot.proposals.discardAll',
        defaultMessage: 'Discard all'
    },
    applying: {
        id: 'copilot.proposals.applying',
        defaultMessage: 'Applying {done} of {total}…'
    },
    discarding: {
        id: 'copilot.proposals.discarding',
        defaultMessage: 'Discarding {done} of {total}…'
    }
});

/**
 * The bar that decides every pending change at once.
 *
 * **Why this exists.** Propose-then-apply
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §5) is
 * per change, and one answer routinely produces a dozen — "add alt text to
 * every image in this article" is one sentence and twelve cards. Clicking
 * twelve times is not review, it is a queue being cleared, and a UI that makes
 * bulk work tedious gets the auto-apply policy switched on for tools that did
 * not warrant it. One deliberate click over a list the user has just scrolled
 * through is the honest version of what they were doing anyway.
 *
 * **It is an accelerator, not a bypass.** Each card is still decided by its own
 * request: the server re-resolves the capability profile per proposal, claims
 * the row with a `pending` predicate, and audits it. Nothing here can approve a
 * change the per-card button could not.
 *
 * **The count is in the button, not only in the sentence above it.** "Apply
 * all" tells you the shape of the action; "Apply all 12" tells you its size,
 * which is the number that should give someone pause.
 *
 * It renders under the transcript rather than over it, so the cards it acts on
 * stay the last thing read before the click.
 */
export function PendingProposals({
    count,
    bulk,
    onDecideAll
}: {
    /** How many proposals are awaiting a decision. */
    count: number;
    /** The bulk decision in flight, or `null`. */
    bulk: BulkDecision | null;
    onDecideAll(decision: 'accept' | 'reject'): void;
}) {
    const intl = useIntl();

    // Kept mounted through the run so the progress line has somewhere to live
    // after the last card leaves the queue.
    if (count === 0 && !bulk) {
        return null;
    }

    if (bulk) {
        return (
            <div
                className="text-muted-foreground flex shrink-0 items-center gap-2 border-t px-3 py-2 text-xs"
                role="status"
            >
                <Spinner className="size-3.5" />
                {intl.formatMessage(
                    bulk.decision === 'accept'
                        ? messages.applying
                        : messages.discarding,
                    { done: bulk.done, total: bulk.total }
                )}
            </div>
        );
    }

    return (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t px-3 py-2">
            <span className="text-muted-foreground mr-auto text-xs">
                {intl.formatMessage(messages.waiting, { count })}
            </span>
            <Button
                size="sm"
                variant="ghost"
                onClick={() => onDecideAll('reject')}
            >
                <X className="size-3.5" />
                {intl.formatMessage(messages.discardAll)}
            </Button>
            <Button size="sm" onClick={() => onDecideAll('accept')}>
                <Check className="size-3.5" />
                {intl.formatMessage(messages.applyAll, { count })}
            </Button>
        </div>
    );
}
