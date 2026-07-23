import { defineMessages, useIntl } from 'react-intl';
import type { RelationRef } from '../../../../../../../domain/types/contentType';

const messages = defineMessages({
    none: {
        id: 'content.revisions.preview.noRecords',
        defaultMessage: 'No records'
    },
    unavailable: {
        id: 'content.revisions.preview.unavailable',
        defaultMessage: 'Unavailable record'
    },
    more: {
        id: 'content.revisions.preview.moreRecords',
        defaultMessage: '+{count} more'
    }
});

/**
 * The **exact linked records** a relation field held in a snapshot — the titled
 * list the preview shows instead of a bare count. A record the server couldn't
 * resolve (soft-deleted or out of workspace) is flagged `missing` and renders as
 * "Unavailable record", never its raw id. The list is capped server-side, so a
 * `total` beyond the resolved `refs` shows a "+N more" tail.
 */
export function RelationRefList({
    refs,
    total
}: {
    refs: readonly RelationRef[];
    total: number;
}) {
    const intl = useIntl();

    if (!refs.length) {
        return (
            <span className="text-muted-foreground">
                {intl.formatMessage(messages.none)}
            </span>
        );
    }

    const overflow = total - refs.length;

    return (
        <ul className="space-y-0.5">
            {refs.map((ref) => (
                <li key={ref.id} className="flex items-baseline gap-1.5">
                    {ref.missing ? (
                        <span className="text-muted-foreground italic">
                            {intl.formatMessage(messages.unavailable)}
                        </span>
                    ) : (
                        <>
                            <span className="truncate">{ref.title}</span>
                            {ref.slug && (
                                <span className="truncate font-mono text-xs text-muted-foreground">
                                    /{ref.slug}
                                </span>
                            )}
                        </>
                    )}
                </li>
            ))}
            {overflow > 0 && (
                <li className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.more, { count: overflow })}
                </li>
            )}
        </ul>
    );
}
