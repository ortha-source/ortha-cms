import { defineMessages, useIntl } from 'react-intl';
import { Check } from 'lucide-react';
import type { ReviewerRowView } from '../../../../domain/reviewerRows';
import { ReviewerLabel } from '../../ReviewerLabel';

const messages = defineMessages({
    approved: {
        id: 'protection.reviewer.approved',
        defaultMessage: 'Approved'
    },
    pending: {
        id: 'protection.reviewer.pending',
        defaultMessage: 'Pending'
    },
    staleVersion: {
        id: 'protection.reviewer.staleVersion',
        defaultMessage:
            'approved version {version} — the entry has changed since, so this no longer counts'
    },
    staleUnknownVersion: {
        id: 'protection.reviewer.staleUnknownVersion',
        defaultMessage:
            'approved an earlier version — the entry has changed since, so this no longer counts'
    }
});

/**
 * One person in the Review block: a green check once they approved the current
 * version, a yellow dot while their approval is pending.
 *
 * **The mark is never the only signal.** "Approved" or "Pending" is written
 * beside it as text, so a reader who does not see colour — or does not see at
 * all — gets the same fact; the icon and the dot are `aria-hidden`.
 *
 * **A pending approval a save left behind still says so.** The count rolls back
 * the moment somebody saves, and without the sentence naming the version that
 * was approved, that rollback is unexplainable to the person who just pressed
 * Save.
 */
export function ReviewerRow({
    row,
    currentUserId
}: {
    row: ReviewerRowView;
    /** The signed-in person, so their own row reads "You". */
    currentUserId?: string;
}) {
    const intl = useIntl();
    const approved = row.state === 'approved';

    return (
        <li className="flex flex-col gap-1">
            <span className="flex items-center justify-between gap-2">
                <ReviewerLabel
                    userId={row.userId}
                    currentUserId={currentUserId}
                />
                <span
                    className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
                    data-state={row.state}
                >
                    {approved ? (
                        <Check
                            aria-hidden
                            className="size-4 text-success"
                            strokeWidth={3}
                        />
                    ) : (
                        <span
                            aria-hidden
                            className="size-2.5 rounded-full bg-warning"
                        />
                    )}
                    {intl.formatMessage(
                        approved ? messages.approved : messages.pending
                    )}
                </span>
            </span>
            {row.staleVersion !== undefined ? (
                <span className="pl-8 text-xs text-muted-foreground">
                    {row.staleVersion === null
                        ? intl.formatMessage(messages.staleUnknownVersion)
                        : intl.formatMessage(messages.staleVersion, {
                              version: row.staleVersion
                          })}
                </span>
            ) : null}
        </li>
    );
}
