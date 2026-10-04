import { defineMessages, useIntl } from 'react-intl';
import { ListChecks } from 'lucide-react';
import { Button } from '@orthacms/design-system';

const messages = defineMessages({
    review: {
        id: 'schemaBuilder.review.button',
        defaultMessage: 'Review changes'
    },
    fixFirst: {
        id: 'schemaBuilder.review.fixFirst',
        defaultMessage: 'Fix the problems first'
    }
});

type Props = { changes: number; issues: number; onClick: () => void };

/** Opens the review. Not before there is something to review, nor while the draft breaks a rule. */
export function ReviewChangesButton({ changes, issues, onClick }: Props) {
    const intl = useIntl();
    if (changes === 0) return null;
    const blocked = issues > 0;
    return (
        <Button
            onClick={onClick}
            disabled={blocked}
            title={blocked ? intl.formatMessage(messages.fixFirst) : undefined}
        >
            <ListChecks />
            {intl.formatMessage(messages.review)}
        </Button>
    );
}
