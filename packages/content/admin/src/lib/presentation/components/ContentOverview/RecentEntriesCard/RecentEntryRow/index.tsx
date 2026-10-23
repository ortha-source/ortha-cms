import { Link } from 'react-router-dom';
import { FileText, Table2 } from 'lucide-react';
import { CONTENT_TYPE_KIND } from '../../../../../domain/constants';
import { useFormatSince } from '../../../../hooks/useFormatSince';
import type { RecentEntry } from '../../../../../application/useRecentEntries';
import { EntryStatusBadge } from '../../../EntryStatusBadge';

type RecentEntryRowProps = {
    item: RecentEntry;
    /** Where the record opens — its editor, or a single's type page. */
    to: string;
};

/**
 * One row of "Recently edited": the type's tile, the record's title over its
 * type (and locale), its status, and how long ago it was saved. The whole row
 * is the link.
 */
export function RecentEntryRow({ item, to }: RecentEntryRowProps) {
    const since = useFormatSince();
    const Icon =
        item.type.kind === CONTENT_TYPE_KIND.Single ? FileText : Table2;

    return (
        <li className="border-t">
            <Link
                to={to}
                className="flex h-[52px] items-center gap-3 px-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
                <span
                    aria-hidden
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-muted"
                >
                    <Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                        {item.locale
                            ? `${item.type.label} · ${item.locale.toUpperCase()}`
                            : item.type.label}
                    </span>
                </span>
                {item.type.publishable ? (
                    // Inside a link: no tooltip, whose trigger is a button.
                    <EntryStatusBadge
                        entry={item.entry}
                        explainModified={false}
                    />
                ) : null}
                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {since(item.updatedAt)}
                </span>
            </Link>
        </li>
    );
}
