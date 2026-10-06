import { defineMessages, useIntl } from 'react-intl';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@orthacms/design-system';
import { toneOf, type EntryReview } from '../../../../domain/types';

const messages = defineMessages({
    needsReview: {
        id: 'protection.chip.needsReview',
        defaultMessage: 'Needs review · {given} of {required}'
    },
    ready: {
        id: 'protection.chip.ready',
        defaultMessage: 'Reviewed · {given} of {required}'
    }
});

/**
 * The review chip in the **Review** block's heading — "Needs review · 0 of 2"
 * while the version is held, "Reviewed · 2 of 2" once it may go out.
 *
 * It used to be a chip of its own in the title row, then a row of Details,
 * and in both places it repeated the count this block already showed a little
 * further down. Here it *is* that count, with the word that says what it
 * means, so the requirement is stated once, beside the people and actions
 * that change it.
 *
 * The block decides whether it renders: nothing on an unprotected type, and a
 * plain count instead on a head that is published and unchanged, where
 * "Needs review" would claim a live record is held.
 *
 * The label carries the count in **text**, so the tone is a second signal
 * rather than the only one: "Needs review · 0 of 2" reads the same to somebody
 * who cannot tell the destructive tone from the success one.
 */
export function ReviewChip({ review }: { review: EntryReview }) {
    const intl = useIntl();
    const tone = toneOf(review);
    const values = { given: review.given, required: review.required };

    return (
        <Badge
            variant={
                tone === 'satisfied'
                    ? 'success'
                    : tone === 'partial'
                      ? 'warning'
                      : 'destructive-soft'
            }
        >
            <ShieldCheck aria-hidden className="size-3" />
            {intl.formatMessage(
                tone === 'satisfied' ? messages.ready : messages.needsReview,
                values
            )}
        </Badge>
    );
}
