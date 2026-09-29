import { defineMessages, useIntl } from 'react-intl';
import { Share2 } from 'lucide-react';
import { Badge, cn } from '@orthacms/design-system';
import type { EntrySource } from '../../../domain/types/contentType';

const messages = defineMessages({
    label: {
        id: 'content.shared.badge',
        defaultMessage: 'Shared · {workspaceName}'
    }
});

/**
 * The mark on a record that lives in **another** (shared) workspace —
 * "Shared · {workspace}" — used wherever such a record is listed beside the
 * open workspace's own: the relation picker's candidate rows and the linked
 * rows of a relation field. Renders nothing for `null`/absent, so a caller can
 * pass any ref's `source` through without a condition of its own.
 *
 * Text, not an icon alone: the workspace name is the information, and a
 * glyph with a tooltip would hide it from touch and screen-reader users.
 */
export function SharedSourceBadge({
    source,
    className
}: {
    /** Where the record lives; `null` for the open workspace's own. */
    source?: EntrySource | null;
    className?: string;
}) {
    const intl = useIntl();
    if (!source) return null;
    return (
        <Badge
            variant="info"
            className={cn('max-w-48 shrink-0 font-normal', className)}
        >
            <Share2 className="size-3 shrink-0" aria-hidden />
            <span className="truncate">
                {intl.formatMessage(messages.label, {
                    workspaceName: source.workspaceName
                })}
            </span>
        </Badge>
    );
}
