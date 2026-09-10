import { defineMessages, useIntl } from 'react-intl';
import { MessageSquare } from 'lucide-react';
import type { ReviewApproval } from '../../../../domain/types';
import { ReviewerLabel } from '../../ReviewerLabel';

const messages = defineMessages({
    approvedVersion: {
        id: 'protection.approval.approvedVersion',
        defaultMessage: 'approved version {version}'
    },
    approvedUnknownVersion: {
        id: 'protection.approval.approvedUnknownVersion',
        defaultMessage: 'approved an earlier version'
    },
    changesVersion: {
        id: 'protection.approval.changesVersion',
        defaultMessage: 'asked for changes on version {version}'
    },
    changesUnknownVersion: {
        id: 'protection.approval.changesUnknownVersion',
        defaultMessage: 'asked for changes'
    },
    staleSuffix: {
        id: 'protection.approval.staleSuffix',
        defaultMessage:
            '— the entry has changed since, so this no longer counts'
    }
});

/**
 * One recorded vote.
 *
 * **A stale approval stays here, struck through, naming its version.** It is
 * the single most important line in this panel: the count rolls back the moment
 * somebody saves, and without the struck-through name pointing at the version
 * it was given on, that rollback is unexplainable to the person who just
 * pressed Save. Every CMS that gets approvals wrong gets them wrong by hiding
 * this.
 *
 * The strike-through is **decoration only**. The same fact — which version was
 * approved, and that the entry has moved on — is written out underneath in
 * ordinary text, so it survives a reader who sees no line, no colour, or no
 * screen at all. `line-through` on its own would be a fact carried by a
 * pixel.
 */
export function ApprovalRow({
    approval,
    currentUserId
}: {
    approval: ReviewApproval;
    /** The signed-in person, so their own vote reads "You". */
    currentUserId?: string;
}) {
    const intl = useIntl();
    const approved = approval.decision === 'approved';
    const version = approval.revisionNumber;

    const what = approved
        ? version === null
            ? intl.formatMessage(messages.approvedUnknownVersion)
            : intl.formatMessage(messages.approvedVersion, { version })
        : version === null
          ? intl.formatMessage(messages.changesUnknownVersion)
          : intl.formatMessage(messages.changesVersion, { version });

    const detail = approval.isStale
        ? `${what} ${intl.formatMessage(messages.staleSuffix)}`
        : what;

    return (
        <li className="flex flex-col gap-1">
            <span
                className={
                    approval.isStale
                        ? 'text-muted-foreground line-through decoration-border'
                        : undefined
                }
            >
                <ReviewerLabel
                    userId={approval.userId}
                    currentUserId={currentUserId}
                />
            </span>
            {/* The sentence, not the strike, is what carries the fact. */}
            <span className="pl-8 text-xs text-muted-foreground">{detail}</span>
            {approval.note ? (
                <span className="flex items-start gap-1.5 pl-8 text-xs text-muted-foreground">
                    <MessageSquare
                        aria-hidden
                        className="mt-0.5 size-3 shrink-0"
                    />
                    <q className="min-w-0">{approval.note}</q>
                </span>
            ) : null}
        </li>
    );
}
