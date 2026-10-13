import { defineMessages, useIntl } from 'react-intl';
import { Trash2 } from 'lucide-react';
import {
    Badge,
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@orthacms/design-system';

const messages = defineMessages({
    label: {
        id: 'content.relations.trashed',
        defaultMessage: 'In trash'
    },
    hint: {
        id: 'content.relations.trashedHint',
        defaultMessage:
            'This record is in the trash. The link is kept, but the content API doesn’t serve it. Restore the record to bring the link back.'
    }
});

/**
 * Marks a linked record that is in the **trash** — the server's
 * `RelationRef.trashed`, which it sets on the workspace's own soft-deleted
 * records in place of the anonymous `missing`.
 *
 * The record keeps its real title beside this mark, so an editor can see
 * *which* record the link waits on; the tooltip says what that means — kept,
 * not served, back on restore. The trigger is a real `<button>` so the
 * explanation opens on focus as well as on hover, the same reason
 * `LocalizedFieldMark` uses one; it suppresses activation, since it may sit
 * inside a row or a label whose own click means something else.
 */
export function TrashedBadge() {
    const intl = useIntl();
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    className="inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Badge variant="warning">
                        <Trash2 aria-hidden className="size-3" />
                        {intl.formatMessage(messages.label)}
                    </Badge>
                </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
                {intl.formatMessage(messages.hint)}
            </TooltipContent>
        </Tooltip>
    );
}
