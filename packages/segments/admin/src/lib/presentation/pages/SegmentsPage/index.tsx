import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    ShieldCheck,
    Trash2
} from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useDebouncedValue, useDocumentTitle } from '@orthacms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    ConfirmDialog,
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
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    toast
} from '@orthacms/design-system';
import type { Segment } from '../../../domain/types';
import {
    SEGMENTS_MANAGE,
    SEGMENTS_READ,
    useCreateSegment,
    useDeleteSegment,
    useSegments,
    useUpdateSegment
} from '../../../application/hooks';
import {
    SegmentDialog,
    type SegmentDraft
} from '../../components/SegmentDialog';

const messages = defineMessages({
    title: { id: 'segments.page.title', defaultMessage: 'Segments' },
    subtitle: {
        id: 'segments.page.subtitle',
        defaultMessage:
            'The audiences your readers are divided into. An entry then says which of them may read it.'
    },
    create: { id: 'segments.page.create', defaultMessage: 'New audience' },
    search: { id: 'segments.page.search', defaultMessage: 'Search audiences' },
    colName: { id: 'segments.page.colName', defaultMessage: 'Audience' },
    colTags: { id: 'segments.page.colTags', defaultMessage: 'Reader tags' },
    colUsage: { id: 'segments.page.colUsage', defaultMessage: 'Used by' },
    usage: {
        id: 'segments.page.usage',
        defaultMessage: '{count, plural, one {# entry} other {# entries}}'
    },
    unused: { id: 'segments.page.unused', defaultMessage: 'Not used yet' },
    menu: { id: 'segments.page.menu', defaultMessage: 'Actions for {name}' },
    edit: { id: 'segments.page.edit', defaultMessage: 'Edit…' },
    remove: { id: 'segments.page.remove', defaultMessage: 'Delete' },
    confirmTitle: {
        id: 'segments.page.confirmTitle',
        defaultMessage: 'Delete “{name}”?'
    },
    confirmBody: {
        id: 'segments.page.confirmBody',
        defaultMessage:
            'It is removed from every entry that names it. An entry that only refused this audience becomes readable by everyone; an entry that only allowed it stops being readable by anyone but the other audiences it names.'
    },
    confirmUnused: {
        id: 'segments.page.confirmUnused',
        defaultMessage:
            'No entry names it, so nothing any reader sees will change.'
    },
    confirm: { id: 'segments.page.confirmCta', defaultMessage: 'Delete' },
    cancel: { id: 'segments.page.cancel', defaultMessage: 'Cancel' },
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

/**
 * The audience directory at `/segments`.
 *
 * One list, four actions. Everything about *what an audience may read* happens
 * on the entry, which is why this page has no notion of rules, targets or
 * levels — it manages the vocabulary, and the entry editor uses it.
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

    const [query, setQuery] = useState('');
    const debounced = useDebouncedValue(query, 250);
    const { data, isPending, isError, refetch } = useSegments(
        debounced || undefined
    );

    const [dialog, setDialog] = useState<{
        open: boolean;
        editing: Segment | null;
    }>({ open: false, editing: null });
    const [pending, setPending] = useState<Segment | null>(null);

    const create = useCreateSegment();
    const update = useUpdateSegment();
    const remove = useDeleteSegment();

    const bar = (
        <PageTopBar
            icon={ShieldCheck}
            crumbs={[
                { key: 'segments', label: intl.formatMessage(messages.title) }
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
    const segments = data ?? [];

    const submit = (draft: SegmentDraft) => {
        const done = () => setDialog({ open: false, editing: null });
        if (dialog.editing) {
            update.mutate(
                {
                    id: dialog.editing.id,
                    label: draft.label,
                    tags: draft.tags
                },
                { onSuccess: done, onError: failed }
            );
            return;
        }
        create.mutate(
            {
                key: draft.key,
                label: draft.label,
                // An empty list means "use the key", which the server fills in
                // — sending `[]` would be an audience matching nobody.
                ...(draft.tags.length ? { tags: draft.tags } : {})
            },
            { onSuccess: done, onError: failed }
        );
    };

    return (
        <>
            {bar}
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                    actions={
                        canManage && segments.length > 0 ? (
                            <Button
                                onClick={() =>
                                    setDialog({ open: true, editing: null })
                                }
                            >
                                <Plus aria-hidden />
                                {intl.formatMessage(messages.create)}
                            </Button>
                        ) : undefined
                    }
                />

                {/* Creating and deleting change the table without a navigation
                    and without a heading change, so announce the count. */}
                {!isPending && !isError ? (
                    <p role="status" aria-live="polite" className="sr-only">
                        {intl.formatMessage(messages.results, {
                            count: segments.length
                        })}
                    </p>
                ) : null}

                {isPending ? (
                    <div role="status" className="mt-4 flex flex-col gap-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : isError ? (
                    <Alert variant="destructive" role="alert" className="mt-4">
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>{intl.formatMessage(messages.error)}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="shadow-none"
                                onClick={() => refetch()}
                            >
                                {intl.formatMessage(messages.cancel)}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : segments.length === 0 && !debounced ? (
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
                                <Button
                                    onClick={() =>
                                        setDialog({ open: true, editing: null })
                                    }
                                >
                                    <Plus aria-hidden />
                                    {intl.formatMessage(messages.create)}
                                </Button>
                            </EmptyContent>
                        ) : null}
                    </Empty>
                ) : (
                    <>
                        <div className="relative w-64">
                            <Search
                                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden
                            />
                            <Input
                                className="pl-8"
                                type="search"
                                value={query}
                                aria-label={intl.formatMessage(messages.search)}
                                placeholder={intl.formatMessage(
                                    messages.search
                                )}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                        </div>

                        {segments.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">
                                {intl.formatMessage(messages.noMatches, {
                                    query: debounced
                                })}
                            </p>
                        ) : (
                            <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-xs">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                {intl.formatMessage(
                                                    messages.colName
                                                )}
                                            </TableHead>
                                            <TableHead>
                                                {intl.formatMessage(
                                                    messages.colTags
                                                )}
                                            </TableHead>
                                            <TableHead>
                                                {intl.formatMessage(
                                                    messages.colUsage
                                                )}
                                            </TableHead>
                                            <TableHead className="w-12" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {segments.map((segment) => (
                                            <TableRow key={segment.id}>
                                                <TableCell className="font-medium">
                                                    {segment.label}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {segment.tags.map(
                                                            (tag) => (
                                                                <code
                                                                    key={tag}
                                                                    className="rounded bg-muted px-1.5 py-0.5 text-xs"
                                                                >
                                                                    {tag}
                                                                </code>
                                                            )
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {segment.usageCount > 0
                                                        ? intl.formatMessage(
                                                              messages.usage,
                                                              {
                                                                  count: segment.usageCount
                                                              }
                                                          )
                                                        : intl.formatMessage(
                                                              messages.unused
                                                          )}
                                                </TableCell>
                                                <TableCell>
                                                    {canManage ? (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="ml-auto"
                                                                    aria-label={intl.formatMessage(
                                                                        messages.menu,
                                                                        {
                                                                            name: segment.label
                                                                        }
                                                                    )}
                                                                >
                                                                    <MoreHorizontal
                                                                        aria-hidden
                                                                    />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onSelect={() =>
                                                                        setDialog(
                                                                            {
                                                                                open: true,
                                                                                editing:
                                                                                    segment
                                                                            }
                                                                        )
                                                                    }
                                                                >
                                                                    <Pencil
                                                                        aria-hidden
                                                                    />
                                                                    {intl.formatMessage(
                                                                        messages.edit
                                                                    )}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onSelect={() =>
                                                                        setPending(
                                                                            segment
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2
                                                                        aria-hidden
                                                                    />
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
                            </div>
                        )}
                    </>
                )}
            </Container>

            <SegmentDialog
                open={dialog.open}
                onOpenChange={(open) =>
                    setDialog((current) => ({ ...current, open }))
                }
                editing={dialog.editing}
                onSubmit={submit}
                submitting={create.isPending || update.isPending}
            />

            <ConfirmDialog
                open={pending !== null}
                onOpenChange={(open) => {
                    if (!open) setPending(null);
                }}
                busy={remove.isPending}
                title={intl.formatMessage(messages.confirmTitle, {
                    name: pending?.label ?? ''
                })}
                // The consequence is spelled out per case rather than as "are
                // you sure": deleting an audience an entry *refused* opens that
                // entry, and deleting one an entry *allowed* closes it further.
                // Both are surprises worth naming before they happen.
                description={intl.formatMessage(
                    pending && pending.usageCount > 0
                        ? messages.confirmBody
                        : messages.confirmUnused
                )}
                confirmLabel={intl.formatMessage(messages.confirm)}
                cancelLabel={intl.formatMessage(messages.cancel)}
                confirmVariant="destructive"
                onConfirm={() => {
                    if (pending) {
                        remove.mutate(pending.id, { onError: failed });
                    }
                    setPending(null);
                }}
            />
        </>
    );
}
