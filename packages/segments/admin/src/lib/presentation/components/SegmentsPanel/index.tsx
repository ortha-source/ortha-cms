import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, Search } from 'lucide-react';
import { useDebouncedValue } from '@orthacms/utils-admin';
import {
    Badge,
    Button,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import type { Segment } from '../../../domain/types/segment';
import type { SegmentType } from '../../../domain/types/segmentType';
import { useSegments } from '../../../application/useSegments';
import { AccessTableSkeleton } from '../AccessSkeleton';
import { SegmentRowActions } from './SegmentRowActions';

const messages = defineMessages({
    heading: {
        id: 'segments.panel.heading',
        defaultMessage: 'Segments in {type}'
    },
    search: {
        id: 'segments.panel.search',
        defaultMessage: 'Search segments'
    },
    create: { id: 'segments.panel.create', defaultMessage: 'New segment' },
    colName: { id: 'segments.panel.colName', defaultMessage: 'Segment' },
    colTags: { id: 'segments.panel.colTags', defaultMessage: 'Reader tags' },
    colUsage: { id: 'segments.panel.colUsage', defaultMessage: 'Used by' },
    usage: {
        id: 'segments.panel.usage',
        defaultMessage: '{count, plural, one {# entry} other {# entries}}'
    },
    unused: { id: 'segments.panel.unused', defaultMessage: 'Not used yet' },
    mask: { id: 'segments.panel.mask', defaultMessage: 'Any' },
    maskTags: {
        id: 'segments.panel.maskTags',
        defaultMessage: 'Every tag in {namespace}'
    },
    empty: {
        id: 'segments.panel.empty',
        defaultMessage:
            'No segments yet. Add the audiences this axis divides readers into.'
    },
    noMatches: {
        id: 'segments.panel.noMatches',
        defaultMessage: 'No segment matches “{query}”.'
    },
    error: {
        id: 'segments.panel.error',
        defaultMessage: 'Couldn’t load the segments.'
    }
});

/** Props for {@link SegmentsPanel}. */
type SegmentsPanelProps = {
    /** The selected type. */
    type: SegmentType;
    /** Whether the caller holds `access:manage`. */
    canManage: boolean;
    /** Opens the create dialog. */
    onCreate: () => void;
    /** Opens the edit dialog on one segment. */
    onEdit: (segment: Segment) => void;
    /** Deletes a segment. */
    onDelete: (segment: Segment) => void;
    /** The id whose delete is in flight, if any. */
    deletingId: string | null;
};

/**
 * The selected type's segments.
 *
 * The **usage count** is the column that earns its place. A picker over four
 * hundred organisations is unreadable without it: it is what tells an
 * administrator that the segment they are about to grant is one nothing
 * references — which is almost always a typo in the key rather than an
 * intention. It is also the reason a delete can be refused, so showing it here
 * is what makes that refusal predictable instead of surprising.
 *
 * The search box is debounced rather than submitted: on a high-cardinality type
 * this is the only usable way to find a segment, and a list that only updates
 * on Enter is a list people scroll instead.
 */
export function SegmentsPanel({
    type,
    canManage,
    onCreate,
    onEdit,
    onDelete,
    deletingId
}: SegmentsPanelProps) {
    const intl = useIntl();
    const [query, setQuery] = useState('');
    const debounced = useDebouncedValue(query, 250);
    const { data, isPending, isError } = useSegments(
        type.key,
        debounced ? { q: debounced } : {}
    );

    const segments = data ?? [];

    return (
        <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-medium">
                    {intl.formatMessage(messages.heading, { type: type.label })}
                </h2>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                        />
                        <Input
                            className="w-56 pl-8"
                            type="search"
                            value={query}
                            aria-label={intl.formatMessage(messages.search)}
                            placeholder={intl.formatMessage(messages.search)}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </div>
                    {canManage ? (
                        <Button variant="outline" onClick={onCreate}>
                            <Plus aria-hidden />
                            {intl.formatMessage(messages.create)}
                        </Button>
                    ) : null}
                </div>
            </div>

            {isPending ? (
                <AccessTableSkeleton rows={3} columns={3} />
            ) : isError ? (
                <p role="alert" className="mt-4 text-sm text-destructive">
                    {intl.formatMessage(messages.error)}
                </p>
            ) : segments.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                    {debounced
                        ? intl.formatMessage(messages.noMatches, {
                              query: debounced
                          })
                        : intl.formatMessage(messages.empty)}
                </p>
            ) : (
                <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-xs">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    {intl.formatMessage(messages.colName)}
                                </TableHead>
                                <TableHead>
                                    {intl.formatMessage(messages.colTags)}
                                </TableHead>
                                <TableHead>
                                    {intl.formatMessage(messages.colUsage)}
                                </TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {segments.map((segment) => (
                                <TableRow key={segment.id}>
                                    <TableCell className="font-medium">
                                        {segment.label}
                                        {segment.kind === 'mask' ? (
                                            <Badge
                                                variant="secondary"
                                                className="ml-2 align-middle"
                                            >
                                                {intl.formatMessage(
                                                    messages.mask
                                                )}
                                            </Badge>
                                        ) : null}
                                    </TableCell>
                                    <TableCell>
                                        {segment.kind === 'mask' ? (
                                            <span className="text-sm text-muted-foreground">
                                                {intl.formatMessage(
                                                    messages.maskTags,
                                                    {
                                                        namespace: `${segment.typeKey}:`
                                                    }
                                                )}
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {segment.tags.map((tag) => (
                                                    <code
                                                        key={tag}
                                                        className="rounded bg-muted px-1.5 py-0.5 text-xs"
                                                    >
                                                        {tag}
                                                    </code>
                                                ))}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {segment.usageCount > 0
                                            ? intl.formatMessage(
                                                  messages.usage,
                                                  { count: segment.usageCount }
                                              )
                                            : intl.formatMessage(
                                                  messages.unused
                                              )}
                                    </TableCell>
                                    <TableCell>
                                        <SegmentRowActions
                                            segment={segment}
                                            canManage={canManage}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                            deleting={deletingId === segment.id}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </section>
    );
}
