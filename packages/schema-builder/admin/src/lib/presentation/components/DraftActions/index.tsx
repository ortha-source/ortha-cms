import { defineMessages, useIntl } from 'react-intl';
import { Undo2 } from 'lucide-react';
import { Badge, Button } from '@orthacms/design-system';

const messages = defineMessages({
    changes: {
        id: 'schemaBuilder.draft.changes',
        defaultMessage:
            '{count, plural, one {# unsaved change} other {# unsaved changes}}'
    },
    issues: {
        id: 'schemaBuilder.draft.issues',
        defaultMessage: '{count, plural, one {# problem} other {# problems}}'
    },
    discard: {
        id: 'schemaBuilder.draft.discard',
        defaultMessage: 'Discard changes'
    }
});

type Props = { changes: number; issues: number; onDiscard: () => void };

/**
 * The header's account of the draft: how much is unsaved, how much is wrong,
 * and the way back. Nothing until something changed. Announced politely, so
 * a person editing a field hears the count move without losing their place.
 */
export function DraftActions({ changes, issues, onDiscard }: Props) {
    const intl = useIntl();
    if (changes === 0) return null;
    return (
        <div className="flex items-center gap-2">
            <span aria-live="polite" className="flex items-center gap-2">
                <Badge variant="warning">
                    {intl.formatMessage(messages.changes, { count: changes })}
                </Badge>
                {issues > 0 && (
                    <Badge variant="destructive-soft">
                        {intl.formatMessage(messages.issues, { count: issues })}
                    </Badge>
                )}
            </span>
            <Button variant="outline" onClick={onDiscard}>
                <Undo2 />
                {intl.formatMessage(messages.discard)}
            </Button>
        </div>
    );
}
