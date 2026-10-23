import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { FileText, Table2 } from 'lucide-react';
import { Skeleton } from '@orthacms/design-system';
import { CONTENT_TYPE_KIND } from '../../../../domain/constants';
import { useFormatSince } from '../../../hooks/useFormatSince';
import type {
    ContentType,
    EntryRecord
} from '../../../../domain/types/contentType';
import { EntryStatusBadge } from '../../EntryStatusBadge';

const messages = defineMessages({
    updated: {
        id: 'content.overview.type.updated',
        defaultMessage: 'updated {ago}'
    },
    neverUpdated: {
        id: 'content.overview.type.neverUpdated',
        defaultMessage: 'no records yet'
    },
    published: {
        id: 'content.overview.type.published',
        defaultMessage: '{count, number} published'
    },
    modified: {
        id: 'content.overview.type.modified',
        defaultMessage: '{count, number} modified'
    },
    drafts: {
        id: 'content.overview.type.drafts',
        defaultMessage: '{count, plural, one {# draft} other {# drafts}}'
    },
    records: {
        id: 'content.overview.type.records',
        defaultMessage: '{count, plural, one {# record} other {# records}}'
    },
    notCreated: {
        id: 'content.overview.type.notCreated',
        defaultMessage: 'Not created yet'
    }
});

/** How a publishable collection's records split across the three states. */
export type StatusSplit = {
    published: number;
    modified: number;
    drafts: number;
};

type ContentTypeCardProps = {
    type: ContentType;
    to: string;
    /** `undefined` while its list read is in flight. */
    total: number | undefined;
    updatedAt: string | null;
    /** A publishable collection's split; `null` when there is none to draw. */
    split: StatusSplit | null;
    /** A single's one record, for its status. */
    single: EntryRecord | null;
};

/**
 * One content type on the overview: its tile, label, last save and record
 * count over a published · modified · drafts bar (a page shows its status
 * instead). The whole card is the link into the type.
 */
export function ContentTypeCard({
    type,
    to,
    total,
    updatedAt,
    split,
    single
}: ContentTypeCardProps) {
    const intl = useIntl();
    const since = useFormatSince();
    const isSingle = type.kind === CONTENT_TYPE_KIND.Single;
    const Icon = isSingle ? FileText : Table2;

    const parts =
        split && total
            ? [
                  {
                      key: 'published',
                      count: split.published,
                      className: 'bg-success'
                  },
                  {
                      key: 'modified',
                      count: split.modified,
                      className: 'bg-warning'
                  },
                  {
                      key: 'drafts',
                      count: split.drafts,
                      className: 'bg-muted-foreground/45'
                  }
              ].filter((part) => part.count > 0)
            : [];

    let summary;
    if (isSingle) {
        summary = !single ? (
            <span className="text-[11px] text-muted-foreground">
                {intl.formatMessage(messages.notCreated)}
            </span>
        ) : type.publishable ? (
            <span>
                <EntryStatusBadge
                    entry={single}
                    explainModified={false}
                    size="xs"
                />
            </span>
        ) : null;
    } else if (split && total) {
        summary = (
            <>
                <div
                    aria-hidden
                    className="flex h-1 gap-px overflow-hidden rounded-full bg-muted"
                >
                    {parts.map((part) => (
                        <i
                            key={part.key}
                            className={part.className}
                            style={{ width: `${(part.count / total) * 100}%` }}
                        />
                    ))}
                </div>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                    {parts
                        .map((part) =>
                            intl.formatMessage(
                                messages[part.key as keyof StatusSplit],
                                { count: part.count }
                            )
                        )
                        .join(' · ')}
                </p>
            </>
        );
    } else if (total !== undefined) {
        summary = (
            <p className="text-[11px] tabular-nums text-muted-foreground">
                {intl.formatMessage(messages.records, { count: total })}
            </p>
        );
    }

    return (
        <Link
            to={to}
            className="flex flex-col gap-2.5 rounded-xl border bg-card p-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div className="flex items-center gap-3">
                <span
                    aria-hidden
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted"
                >
                    <Icon className="size-3.5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] leading-4 font-semibold">
                        {type.label}
                    </span>
                    <div className="truncate text-[11px] leading-4 text-muted-foreground">
                        {total === undefined ? (
                            <Skeleton className="mt-0.5 h-3 w-24" />
                        ) : updatedAt ? (
                            intl.formatMessage(messages.updated, {
                                ago: since(updatedAt)
                            })
                        ) : (
                            intl.formatMessage(messages.neverUpdated)
                        )}
                    </div>
                </div>
                {!isSingle && total !== undefined ? (
                    <span className="text-[15px] font-semibold tabular-nums">
                        {intl.formatNumber(total)}
                    </span>
                ) : null}
            </div>
            {summary}
        </Link>
    );
}
