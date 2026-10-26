import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';

const messages = defineMessages({
    tally: {
        id: 'protection.queue.tallyShort',
        defaultMessage: '{given} of {required}'
    },
    tallyNoun: {
        id: 'protection.queue.tallyNoun',
        defaultMessage: 'approvals'
    }
});

/**
 * How far an ask has got: one pip per approval the rule wants, filled for each
 * that counts, then "1 of 2".
 *
 * **The tally is a sentence, not a fragment.** "1 of 2" read aloud out of a row
 * is a pair of numbers with no subject, so an `sr-only` "approvals" follows it
 * and the pips — a picture of the same number — are hidden from the
 * accessibility tree. Nothing here counts: `given` and `required` arrive from
 * the server.
 */
export function ApprovalProgress({
    given,
    required,
    className
}: {
    given: number;
    required: number;
    className?: string;
}) {
    const intl = useIntl();
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap',
                className
            )}
        >
            <span aria-hidden className="inline-flex gap-[3px]">
                {Array.from({ length: required }, (_, index) => (
                    <i
                        key={index}
                        className={cn(
                            'block size-2 rounded-[2px]',
                            index < given
                                ? 'bg-success'
                                : 'bg-muted-foreground/25'
                        )}
                    />
                ))}
            </span>
            <span className="text-[13px] text-muted-foreground">
                {intl.formatMessage(messages.tally, { given, required })}
                <span className="sr-only">
                    {' '}
                    {intl.formatMessage(messages.tallyNoun)}
                </span>
            </span>
        </span>
    );
}
