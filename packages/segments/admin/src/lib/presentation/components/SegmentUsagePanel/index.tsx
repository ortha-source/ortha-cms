import { useId, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { ChevronDown, FileText } from 'lucide-react';
import {
    Badge,
    Button,
    Card,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Skeleton,
    cn
} from '@orthacms/design-system';
import type { Segment } from '../../../domain/types';
import {
    entryHref,
    recordsHref,
    usageGroups,
    USAGE_STATE,
    type WorkspaceUsageItem
} from '../../../domain/usage';
import { useSegmentUsage } from '../../../application/hooks';

const messages = defineMessages({
    heading: {
        id: 'segments.usage.heading',
        defaultMessage:
            '{count, plural, =0 {Not used yet} one {Used by # entry} other {Used by # entries}}'
    },
    openInRecords: {
        id: 'segments.usage.openInRecords',
        defaultMessage: 'Open in records'
    },
    group: {
        id: 'segments.usage.group',
        defaultMessage: '{type} in {workspace} ({count})'
    },
    canSee: { id: 'segments.usage.canSee', defaultMessage: 'Can see' },
    cannotSee: { id: 'segments.usage.cannotSee', defaultMessage: 'Cannot see' },
    untitled: {
        id: 'segments.usage.untitled',
        defaultMessage: 'Untitled entry'
    },
    trashed: { id: 'segments.usage.trashed', defaultMessage: 'In trash' },
    meta: {
        id: 'segments.usage.meta',
        defaultMessage: '{type} · {workspace}'
    },
    showAll: {
        id: 'segments.usage.showAll',
        defaultMessage: 'Show all {count}'
    },
    showFewer: {
        id: 'segments.usage.showFewer',
        defaultMessage: 'Show fewer'
    },
    onlyInRecords: {
        id: 'segments.usage.onlyInRecords',
        defaultMessage:
            '{count, plural, one {# more entry is} other {# more entries are}} only in records.'
    },
    elsewhere: {
        id: 'segments.usage.elsewhere',
        defaultMessage:
            '{count, plural, one {# more entry} other {# more entries}} in workspaces you can’t open.'
    },
    empty: {
        id: 'segments.usage.empty',
        defaultMessage:
            'No entry names this audience, so changing its tags changes nothing readers see.'
    },
    loading: {
        id: 'segments.usage.loading',
        defaultMessage: 'Loading where it’s used…'
    },
    error: {
        id: 'segments.usage.error',
        defaultMessage: 'Couldn’t load the entries that use it.'
    },
    retry: { id: 'segments.usage.retry', defaultMessage: 'Try again' }
});

/** How many entries the panel lists before "Show all". */
const SHOWN = 8;

/**
 * "Where it's used" — beside the audience form, the entries that name it and
 * whether each **allows** or **refuses** it, read before somebody changes the
 * tags those entries rely on.
 *
 * The rows come from the workspace-scoped usage route, asked of every workspace
 * the caller can open (`useSegmentUsage`), so an entry is named only to somebody
 * who could open it. The directory's `usageCount` is installation-wide; the
 * difference is counted under the list ("N more in workspaces you can't open")
 * rather than dropped, because the heading would otherwise claim a smaller
 * reach than the tags really have.
 *
 * **Eight rows, then "Show all N".** An audience on sixty entries would
 * otherwise push the delete card off the page; expanded, every entry the
 * server returned is listed and scrolls **inside** the panel (about 28rem),
 * and the same button folds it back ("Show fewer") so focus never moves.
 * Entries past the server's page are counted ("N more are only in records").
 *
 * "Open in records" goes to the records list filtered to the audience — one
 * link when the entries are all one type in one workspace, a menu of them
 * otherwise, since a records list is exactly one of each.
 */
export function SegmentUsagePanel({ segment }: { segment: Segment }) {
    const intl = useIntl();
    const listId = useId();
    const usage = useSegmentUsage(segment.id);
    const [expanded, setExpanded] = useState(false);
    if (!usage.enabled) return null;

    const groups = usageGroups(usage.items);
    const workspaces = new Set(usage.items.map((item) => item.workspaceId));
    const types = new Set(usage.items.map((item) => item.typeSlug));
    const collapsible = usage.items.length > SHOWN;
    const open = expanded && collapsible;
    const shown = open ? usage.items : usage.items.slice(0, SHOWN);
    // Past the server's page the entries are counted, not listed: the records
    // list (the link in the header) is where they are read.
    const onlyInRecords = Math.max(0, usage.total - usage.items.length);
    const settled = !usage.isPending && !usage.isError;
    const elsewhere = Math.max(0, segment.usageCount - usage.total);

    return (
        <Card className="overflow-hidden shadow-none">
            <section aria-labelledby="segment-usage-heading">
                <div className="flex items-center gap-3 border-b px-4 py-3">
                    <h2
                        id="segment-usage-heading"
                        className="text-sm font-semibold"
                    >
                        {usage.isPending
                            ? intl.formatMessage(messages.heading, {
                                  count: segment.usageCount
                              })
                            : intl.formatMessage(messages.heading, {
                                  count: usage.total
                              })}
                    </h2>
                    <span className="flex-1" />
                    {groups.length === 1 ? (
                        <Link
                            to={recordsHref(
                                groups[0].workspaceId,
                                groups[0].typeSlug,
                                segment.id
                            )}
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                            {intl.formatMessage(messages.openInRecords)}
                        </Link>
                    ) : groups.length > 1 ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-muted-foreground"
                                >
                                    {intl.formatMessage(messages.openInRecords)}
                                    <ChevronDown aria-hidden />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {groups.map((group) => (
                                    <DropdownMenuItem
                                        key={`${group.workspaceId}/${group.typeSlug}`}
                                        asChild
                                    >
                                        <Link
                                            to={recordsHref(
                                                group.workspaceId,
                                                group.typeSlug,
                                                segment.id
                                            )}
                                        >
                                            {intl.formatMessage(
                                                messages.group,
                                                {
                                                    type: group.typeLabel,
                                                    workspace:
                                                        group.workspaceName,
                                                    count: group.count
                                                }
                                            )}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}
                </div>

                {usage.isPending ? (
                    <div role="status" className="flex flex-col">
                        <span className="sr-only">
                            {intl.formatMessage(messages.loading)}
                        </span>
                        {[0, 1, 2].map((row) => (
                            <div
                                key={row}
                                aria-hidden
                                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                            >
                                <Skeleton className="size-4" />
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-4 w-14" />
                            </div>
                        ))}
                    </div>
                ) : usage.isError ? (
                    <div
                        role="alert"
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground"
                    >
                        <span>{intl.formatMessage(messages.error)}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shadow-none"
                            onClick={usage.refetch}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </div>
                ) : usage.total === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                        {intl.formatMessage(messages.empty)}
                    </p>
                ) : (
                    // Expanded, the whole list scrolls inside the panel rather
                    // than pushing the delete card off the page; the border
                    // under it is the scroll edge.
                    <ul
                        id={listId}
                        className={cn(
                            open &&
                                'max-h-[28rem] overflow-y-auto overscroll-contain border-b shadow-[inset_0_-10px_8px_-10px_rgb(0_0_0/0.15)]'
                        )}
                    >
                        {shown.map((item) => (
                            <UsageRow
                                key={`${item.workspaceId}/${item.entryId}`}
                                item={item}
                                showType={types.size > 1}
                                showWorkspace={workspaces.size > 1}
                            />
                        ))}
                    </ul>
                )}

                {settled && collapsible ? (
                    // One button for both directions, so focus stays on it
                    // whichever way the list was just folded.
                    <div className={cn('px-2 py-1.5', !open && 'border-t')}>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-full justify-center text-xs"
                            aria-expanded={open}
                            aria-controls={listId}
                            onClick={() => setExpanded((value) => !value)}
                        >
                            {open
                                ? intl.formatMessage(messages.showFewer)
                                : intl.formatMessage(messages.showAll, {
                                      count: usage.items.length
                                  })}
                            <ChevronDown
                                aria-hidden
                                className={cn(
                                    'transition-transform motion-reduce:transition-none',
                                    open && 'rotate-180'
                                )}
                            />
                        </Button>
                    </div>
                ) : null}
                {settled && onlyInRecords > 0 ? (
                    <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                        {intl.formatMessage(messages.onlyInRecords, {
                            count: onlyInRecords
                        })}
                    </p>
                ) : null}
                {settled && elsewhere > 0 ? (
                    <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                        {intl.formatMessage(messages.elsewhere, {
                            count: elsewhere
                        })}
                    </p>
                ) : null}
            </section>
        </Card>
    );
}

/** One entry naming the audience, with the side it is on. */
function UsageRow({
    item,
    showType,
    showWorkspace
}: {
    item: WorkspaceUsageItem;
    /** Only when the list spans types — otherwise it is the same on every row. */
    showType: boolean;
    /** Only when the list spans workspaces, for the same reason. */
    showWorkspace: boolean;
}) {
    const intl = useIntl();
    const title = item.title ?? intl.formatMessage(messages.untitled);
    const allows = item.state === USAGE_STATE.Allow;
    const where = showWorkspace
        ? intl.formatMessage(messages.meta, {
              type: item.typeLabel,
              workspace: item.workspaceName
          })
        : showType
          ? item.typeLabel
          : null;
    const hasMeta = Boolean(where || item.locale || item.trashed);

    return (
        <li className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
            <FileText
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
            />
            <span className="flex min-w-0 flex-1 flex-col">
                <Link
                    to={entryHref(item)}
                    className="break-words hover:underline"
                >
                    {title}
                </Link>
                {hasMeta ? (
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {where ? <span>{where}</span> : null}
                        {item.locale ? (
                            <span className="font-mono uppercase">
                                {item.locale}
                            </span>
                        ) : null}
                        {item.trashed ? (
                            <span>{intl.formatMessage(messages.trashed)}</span>
                        ) : null}
                    </span>
                ) : null}
            </span>
            <Badge size="xs" variant={allows ? 'success' : 'destructive-soft'}>
                {intl.formatMessage(
                    allows ? messages.canSee : messages.cannotSee
                )}
            </Badge>
        </li>
    );
}
