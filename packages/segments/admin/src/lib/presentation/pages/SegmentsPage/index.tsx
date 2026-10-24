import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import {
    Globe,
    Info,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    ShieldCheck,
    Trash2
} from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { WorkspaceAvatar, useWorkspaces } from '@orthacms/workspaces-admin';
import {
    initialsOf,
    useDebouncedValue,
    useDocumentTitle,
    useJustCreated
} from '@orthacms/utils-admin';
import {
    Alert,
    AlertDescription,
    Badge,
    Button,
    Container,
    ContainerHeader,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    cn,
    toast
} from '@orthacms/design-system';
import type { Segment } from '../../../domain/types';
import {
    SEGMENTS_MANAGE,
    SEGMENTS_READ,
    SEGMENTS_SCOPE,
    useDeleteSegment,
    useSegments
} from '../../../application/hooks';
import { SegmentsPagination } from '../../components/SegmentsPagination';
import { DeleteSegmentDialog } from '../../components/DeleteSegmentDialog';
import { SegmentsListSkeleton } from '../../components/SegmentsListSkeleton';

const messages = defineMessages({
    crumb: { id: 'segments.page.crumb', defaultMessage: 'Segments' },
    title: { id: 'segments.page.heading', defaultMessage: 'Audiences' },
    subtitle: {
        id: 'segments.page.lede',
        defaultMessage:
            'Groups of readers. An entry says which audiences may read it; everything else stays public.'
    },
    model: {
        id: 'segments.page.model',
        defaultMessage:
            'A reader arrives with tags from your site (for example a customer id). If one matches an audience’s tag, they are in it.'
    },
    create: { id: 'segments.page.create', defaultMessage: 'New audience' },
    search: { id: 'segments.page.search', defaultMessage: 'Search audiences' },
    colName: { id: 'segments.page.colName', defaultMessage: 'Audience' },
    colTags: { id: 'segments.page.colTags', defaultMessage: 'Reader tags' },
    colWorkspaces: {
        id: 'segments.page.colWorkspaces',
        defaultMessage: 'Offered in'
    },
    colUsage: { id: 'segments.page.colUsage', defaultMessage: 'Used by' },
    colActions: { id: 'segments.page.colActions', defaultMessage: 'Actions' },
    everywhere: {
        id: 'segments.page.everywhere',
        defaultMessage: 'Every workspace'
    },
    workspaceCount: {
        id: 'segments.page.workspaceCount',
        defaultMessage:
            '{count, plural, one {# workspace} other {# workspaces}}'
    },
    offeredIn: {
        id: 'segments.page.offeredIn',
        defaultMessage: 'Offered in {workspaces}'
    },
    usageLink: {
        id: 'segments.page.usageLink',
        defaultMessage:
            '{count, plural, one {# entry} other {# entries}}, see where {name} is used'
    },
    usage: {
        id: 'segments.page.usage',
        defaultMessage: '{count, plural, one {# entry} other {# entries}}'
    },
    unused: { id: 'segments.page.unused', defaultMessage: 'Not used yet' },
    menu: { id: 'segments.page.menu', defaultMessage: 'Actions for {name}' },
    edit: { id: 'segments.page.edit', defaultMessage: 'Edit' },
    remove: { id: 'segments.page.remove', defaultMessage: 'Delete' },
    retry: { id: 'segments.page.retry', defaultMessage: 'Try again' },
    emptyTitle: {
        id: 'segments.page.emptyTitle',
        defaultMessage: 'No audiences yet'
    },
    emptyBody: {
        id: 'segments.page.emptyBody',
        defaultMessage:
            'Until one exists every published entry is readable by everyone, and nothing about your content API changes. Create one to start deciding who sees what.'
    },
    noMatches: {
        id: 'segments.page.noMatches',
        defaultMessage: 'No audience matches “{query}”.'
    },
    error: {
        id: 'segments.page.error',
        defaultMessage: 'Couldn’t load the audiences.'
    },
    writeError: {
        id: 'segments.page.writeError',
        defaultMessage: 'Couldn’t save that. Please try again.'
    },
    noAccessTitle: {
        id: 'segments.page.noAccessTitle',
        defaultMessage: 'You don’t have access to segments'
    },
    noAccessBody: {
        id: 'segments.page.noAccessBody',
        defaultMessage:
            'Ask an administrator for the “segments:read” permission to see which readers content is restricted to.'
    },
    results: {
        id: 'segments.page.results',
        defaultMessage: '{count, plural, one {# audience} other {# audiences}}'
    }
});

/** Rows per page before anyone changes it. */
const DEFAULT_PAGE_SIZE = 25;

/**
 * The audience directory at `/segments`.
 *
 * One list, four actions. Everything about *what an audience may read* happens
 * on the entry, which is why this page has no notion of rules, targets or
 * levels — it manages the vocabulary, and the entry editor uses it.
 *
 * **The page says what an audience is**, once above the table and once below
 * it: "segments" alone told people nothing, and the model is two sentences
 * long. The heading is "Audiences" — the noun the rest of the UI uses — while
 * the nav item and the crumb keep the section's name.
 *
 * Creating and editing are **pages** (`/segments/new`, `/segments/:id`), not a
 * dialog: an audience also decides which workspaces may use it, and shows
 * where it is used beside its form.
 *
 * Gated on `segments:read`; the write controls additionally on
 * `segments:manage`. The split is the point of two permissions: an editor needs
 * to *see* that an entry is restricted — one who cannot will publish something
 * believing it is public — while renaming an audience's tags changes who every
 * entry naming it is visible to.
 */
export function SegmentsPage() {
    const intl = useIntl();
    useDocumentTitle(intl.formatMessage(messages.title));
    const canRead = useHasPermission(SEGMENTS_READ);
    const canManage = useHasPermission(SEGMENTS_MANAGE);
    const isJustCreated = useJustCreated(SEGMENTS_SCOPE);

    const [query, setQuery] = useState('');
    const debounced = useDebouncedValue(query, 250);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // A narrowed search almost always has fewer pages than the one before it,
    // so staying on page four is how a reader lands on "no matches" for a term
    // that matches plenty.
    useEffect(() => setPage(1), [debounced, pageSize]);

    const { data, isPending, isError, isPlaceholderData, refetch } =
        useSegments({
            query: debounced || undefined,
            page,
            pageSize
        });

    const total = data?.total ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    // The list can shrink under the page it is on — deleting the last audience
    // of the last page, or another administrator deleting one while this tab
    // sits there — and the refetch then answers that page with no rows: an
    // empty table over "Page 3 of 2", with the pager the only way back. Pull
    // the page back once the fresh total lands. Guarded on `!isPlaceholderData`
    // so it reads that total, not the previous page's that `keepPreviousData`
    // holds while the request is in flight.
    useEffect(() => {
        if (data && !isPlaceholderData && page > pageCount) {
            setPage(pageCount);
        }
    }, [data, isPlaceholderData, page, pageCount]);

    const [pending, setPending] = useState<Segment | null>(null);
    const remove = useDeleteSegment();

    const bar = (
        <PageTopBar
            icon={ShieldCheck}
            crumbs={[
                { key: 'segments', label: intl.formatMessage(messages.crumb) }
            ]}
        />
    );

    if (!canRead) {
        return (
            <>
                {bar}
                <Container>
                    <ContainerHeader
                        title={intl.formatMessage(messages.title)}
                    />
                    <div className="mt-8 flex flex-col items-center gap-3 text-center">
                        <ShieldCheck
                            className="size-10 text-muted-foreground"
                            aria-hidden
                        />
                        <h2 className="text-lg font-medium">
                            {intl.formatMessage(messages.noAccessTitle)}
                        </h2>
                        <p className="max-w-md text-sm text-muted-foreground">
                            {intl.formatMessage(messages.noAccessBody)}
                        </p>
                    </div>
                </Container>
            </>
        );
    }

    const failed = () => toast.error(intl.formatMessage(messages.writeError));
    const segments = data?.items ?? [];

    return (
        <>
            {bar}
            <Container>
                <div className="max-w-[940px]">
                    <ContainerHeader
                        title={intl.formatMessage(messages.title)}
                        subtitle={intl.formatMessage(messages.subtitle)}
                        actions={
                            canManage && (total > 0 || Boolean(debounced)) ? (
                                <Button asChild>
                                    <Link to="/segments/new">
                                        <Plus aria-hidden />
                                        {intl.formatMessage(messages.create)}
                                    </Link>
                                </Button>
                            ) : undefined
                        }
                    />

                    {/* Deleting changes the table without a navigation and
                        without a heading change, so announce the count. */}
                    {!isPending && !isError ? (
                        <p role="status" aria-live="polite" className="sr-only">
                            {intl.formatMessage(messages.results, {
                                count: total
                            })}
                        </p>
                    ) : null}

                    {isPending ? (
                        // The same skeleton the route's own chunk fallback
                        // draws, so loading the page and loading its rows are
                        // one shape rather than two.
                        <SegmentsListSkeleton />
                    ) : isError ? (
                        <Alert
                            variant="destructive"
                            role="alert"
                            className="mt-4"
                        >
                            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                                <span>
                                    {intl.formatMessage(messages.error)}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="shadow-none"
                                    onClick={() => refetch()}
                                >
                                    {intl.formatMessage(messages.retry)}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : total === 0 && !debounced ? (
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <ShieldCheck aria-hidden />
                                </EmptyMedia>
                                <EmptyTitle>
                                    {intl.formatMessage(messages.emptyTitle)}
                                </EmptyTitle>
                                <EmptyDescription>
                                    {intl.formatMessage(messages.emptyBody)}
                                </EmptyDescription>
                            </EmptyHeader>
                            {canManage ? (
                                <EmptyContent>
                                    <Button asChild>
                                        <Link to="/segments/new">
                                            <Plus aria-hidden />
                                            {intl.formatMessage(
                                                messages.create
                                            )}
                                        </Link>
                                    </Button>
                                </EmptyContent>
                            ) : null}
                        </Empty>
                    ) : (
                        <>
                            <div className="relative w-64 max-w-full">
                                <Search
                                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden
                                />
                                <Input
                                    className="pl-8"
                                    type="search"
                                    value={query}
                                    aria-label={intl.formatMessage(
                                        messages.search
                                    )}
                                    placeholder={intl.formatMessage(
                                        messages.search
                                    )}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                />
                            </div>

                            {total === 0 ? (
                                <p className="mt-4 text-sm text-muted-foreground">
                                    {intl.formatMessage(messages.noMatches, {
                                        query: debounced
                                    })}
                                </p>
                            ) : (
                                <>
                                    <div className="mt-4">
                                        <SegmentsTable
                                            segments={segments}
                                            stale={isPlaceholderData}
                                            canManage={canManage}
                                            isJustCreated={isJustCreated}
                                            onDelete={setPending}
                                        />
                                    </div>

                                    <SegmentsPagination
                                        page={page}
                                        pageCount={pageCount}
                                        pageSize={pageSize}
                                        total={total}
                                        onPageChange={setPage}
                                        onPageSizeChange={setPageSize}
                                    />
                                </>
                            )}

                            {/* The model, said once more where the table
                                ends — the line a reader who skipped the lede
                                is looking at when they wonder what a tag is. */}
                            <p className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                                <Info
                                    className="mt-0.5 size-4 shrink-0"
                                    aria-hidden
                                />
                                <span>
                                    {intl.formatMessage(messages.model)}
                                </span>
                            </p>
                        </>
                    )}
                </div>
            </Container>

            <DeleteSegmentDialog
                segment={pending}
                onOpenChange={(open) => {
                    if (!open) setPending(null);
                }}
                busy={remove.isPending}
                onConfirm={() => {
                    if (pending) {
                        // No page arithmetic here: the clamp above settles
                        // the page from the refetched total, and a decrement
                        // on top of it would step back twice.
                        remove.mutate(pending.id, { onError: failed });
                    }
                    setPending(null);
                }}
            />
        </>
    );
}

/** The directory's table — one row per audience. */
function SegmentsTable({
    segments,
    stale,
    canManage,
    isJustCreated,
    onDelete
}: {
    segments: Segment[];
    stale: boolean;
    canManage: boolean;
    isJustCreated: (id: string) => boolean;
    onDelete: (segment: Segment) => void;
}) {
    const intl = useIntl();

    return (
        <Table stale={stale}>
            <TableHeader>
                <TableRow>
                    <TableHead>
                        {intl.formatMessage(messages.colName)}
                    </TableHead>
                    <TableHead>
                        {intl.formatMessage(messages.colTags)}
                    </TableHead>
                    <TableHead>
                        {intl.formatMessage(messages.colWorkspaces)}
                    </TableHead>
                    <TableHead>
                        {intl.formatMessage(messages.colUsage)}
                    </TableHead>
                    {/* Named, not empty. A header cell with no text is a
                        column a screen reader announces as nothing at all
                        while reading every row's menu under it. */}
                    <TableHead className="w-12">
                        <span className="sr-only">
                            {intl.formatMessage(messages.colActions)}
                        </span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {segments.map((segment) => (
                    <TableRow
                        key={segment.id}
                        className={cn(isJustCreated(segment.id) && 'ds-flash')}
                    >
                        <TableCell>
                            <span className="flex flex-col">
                                {canManage ? (
                                    <Link
                                        to={`/segments/${segment.id}`}
                                        className="font-medium hover:underline"
                                    >
                                        {segment.label}
                                    </Link>
                                ) : (
                                    <span className="font-medium">
                                        {segment.label}
                                    </span>
                                )}
                                <span className="font-mono text-xs text-muted-foreground">
                                    {segment.key}
                                </span>
                            </span>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-wrap gap-1">
                                {segment.tags.map((tag) => (
                                    <code
                                        key={tag}
                                        className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs"
                                    >
                                        {tag}
                                    </code>
                                ))}
                            </div>
                        </TableCell>
                        <TableCell>
                            <OfferedInCell
                                workspaceIds={segment.workspaceIds}
                            />
                        </TableCell>
                        <TableCell className="text-sm">
                            {segment.usageCount > 0 && canManage ? (
                                // The audience's page lists the entries and
                                // opens them in the records list — a records
                                // list is one workspace's, and this directory
                                // is the installation's.
                                <Link
                                    to={`/segments/${segment.id}`}
                                    className="text-foreground underline underline-offset-2"
                                    aria-label={intl.formatMessage(
                                        messages.usageLink,
                                        {
                                            count: segment.usageCount,
                                            name: segment.label
                                        }
                                    )}
                                >
                                    {intl.formatMessage(messages.usage, {
                                        count: segment.usageCount
                                    })}
                                </Link>
                            ) : segment.usageCount > 0 ? (
                                intl.formatMessage(messages.usage, {
                                    count: segment.usageCount
                                })
                            ) : (
                                <span className="text-muted-foreground">
                                    {intl.formatMessage(messages.unused)}
                                </span>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                            {canManage ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="ml-auto size-7"
                                            aria-label={intl.formatMessage(
                                                messages.menu,
                                                { name: segment.label }
                                            )}
                                        >
                                            <MoreHorizontal aria-hidden />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem asChild>
                                            <Link
                                                to={`/segments/${segment.id}`}
                                            >
                                                <Pencil aria-hidden />
                                                {intl.formatMessage(
                                                    messages.edit
                                                )}
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onSelect={() => onDelete(segment)}
                                        >
                                            <Trash2 aria-hidden />
                                            {intl.formatMessage(
                                                messages.remove
                                            )}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : null}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

/**
 * Where an audience is offered: "Every workspace" when it names none — empty
 * means every one, so it is said rather than left blank — otherwise the
 * workspaces' monograms, named for a screen reader in one line.
 *
 * A workspace the list does not know (deleted, or not yet loaded) falls back
 * to a count rather than a blank, so the cell never reads as "nowhere".
 */
function OfferedInCell({ workspaceIds }: { workspaceIds: readonly string[] }) {
    const intl = useIntl();
    const workspaces = useWorkspaces();

    if (!workspaceIds.length) {
        return (
            <Badge variant="line" size="xs">
                <Globe className="size-3" aria-hidden />
                {intl.formatMessage(messages.everywhere)}
            </Badge>
        );
    }

    const known = (workspaces.data ?? []).filter((workspace) =>
        workspaceIds.includes(workspace.id)
    );
    if (known.length !== workspaceIds.length) {
        return (
            <Badge variant="secondary" size="xs">
                {intl.formatMessage(messages.workspaceCount, {
                    count: workspaceIds.length
                })}
            </Badge>
        );
    }

    const names = intl.formatList(known.map((workspace) => workspace.name));
    return (
        <span className="inline-flex items-center" title={names}>
            {/* The monograms are for the eye; the sentence beside them is
                what a screen reader reads. */}
            <span aria-hidden className="inline-flex items-center gap-[3px]">
                {known.map((workspace) => (
                    <WorkspaceAvatar
                        key={workspace.id}
                        initials={initialsOf(workspace.name)}
                        color={workspace.color}
                        className="size-5 rounded-[5px] text-[9px]"
                    />
                ))}
            </span>
            <span className="sr-only">
                {intl.formatMessage(messages.offeredIn, { workspaces: names })}
            </span>
        </span>
    );
}
