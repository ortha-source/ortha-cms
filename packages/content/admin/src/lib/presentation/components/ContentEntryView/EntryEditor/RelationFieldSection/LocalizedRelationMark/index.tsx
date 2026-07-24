import { defineMessages, useIntl } from 'react-intl';
import { Globe } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@ortha-cms/design-system';

const messages = defineMessages({
    name: {
        id: 'content.relations.localizedMark',
        defaultMessage: 'Localized relation'
    },
    hint: {
        id: 'content.relations.localizedMarkHint',
        defaultMessage:
            'This relation targets a localized collection, so its links belong to the record’s locale. Only records in the same locale can be picked.'
    }
});

/**
 * Marks a relation whose **target collection is localized**, mirroring the
 * per-field globe on a `localized` scalar.
 *
 * It labels the *field*, not each linked row, because every link on the row is
 * necessarily in the record's own locale — the picker scopes candidates
 * strictly to it, so cross-locale linking can't happen. Repeating one identical
 * locale down every row would be noise; what isn't obvious is *why* the picker
 * hides records the user knows exist, and that is exactly what this explains.
 */
export function LocalizedRelationMark() {
    const intl = useIntl();
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="inline-flex shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Globe aria-hidden className="size-3.5" />
                    <span className="sr-only">
                        {intl.formatMessage(messages.name)}
                    </span>
                </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
                {intl.formatMessage(messages.hint)}
            </TooltipContent>
        </Tooltip>
    );
}
