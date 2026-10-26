import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    CONTENT_FIELD_TYPE,
    MediaRefList,
    RelationRefList,
    diffRevision,
    fieldLabel,
    formatRevisionValue,
    useContentSchema,
    useRevisionDetail,
    type RevisionDetail,
    type RevisionFieldDiff
} from '@orthacms/content-admin';
import {
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';

const messages = defineMessages({
    caption: {
        id: 'protection.panel.changes.caption',
        defaultMessage: 'Changes since it was last published'
    },
    field: { id: 'protection.panel.changes.field', defaultMessage: 'Field' },
    live: { id: 'protection.panel.changes.live', defaultMessage: 'Live' },
    current: {
        id: 'protection.panel.changes.current',
        defaultMessage: 'This version'
    },
    wasLive: {
        id: 'protection.panel.changes.wasLive',
        defaultMessage: 'Live:'
    },
    isNow: {
        id: 'protection.panel.changes.isNow',
        defaultMessage: 'This version:'
    },
    notLive: {
        id: 'protection.panel.changes.notLive',
        defaultMessage: 'Not published'
    },
    none: {
        id: 'protection.panel.changes.none',
        defaultMessage: 'Nothing has changed since it was published.'
    },
    loading: {
        id: 'protection.panel.changes.loading',
        defaultMessage: 'Loading the changes…'
    },
    failed: {
        id: 'protection.panel.changes.failed',
        defaultMessage:
            'The changes could not be loaded. Open the record to see them.'
    },
    gone: {
        id: 'protection.panel.changes.gone',
        defaultMessage:
            'This record has no saved versions to compare. Open it to see where it stands.'
    }
});

/** What a never-published record is compared against: nothing at all. */
const NOTHING_LIVE: RevisionDetail['snapshot'] = { values: {}, relations: {} };

/**
 * What changed between the live version and the one waiting for approval,
 * field by field — "Field · Live · This version", the live value struck out and
 * the new one beside it.
 *
 * **Content's comparison, not a second one.** It reads the two revisions
 * through content-admin's `useRevisionDetail` and compares them with
 * `diffRevision` — the rule History uses, and the rule the server's
 * `diffSnapshots` mirrors when it counts "3 fields changed" for the queue line —
 * so the number on the row and the rows in this table agree. Values render
 * through content's own `formatRevisionValue`, and a relation or media field as
 * the records or assets it holds, never as raw ids.
 *
 * The strike and the tint are `<del>` / `<ins>`, with a hidden lead-in naming
 * each side, so the change is stated to a screen reader as well as drawn.
 *
 * A record never published is compared against an empty document — every
 * filled field is new — and its Live column says so.
 */
export function ReviewChanges({
    typeName,
    entryId,
    headNumber,
    liveNumber
}: {
    typeName: string;
    entryId: string;
    /** The version waiting for approval; `null` when its revisions have gone. */
    headNumber: number | null;
    /** The live version; `null` when the record has never been published. */
    liveNumber: number | null;
}) {
    const intl = useIntl();
    const same = headNumber != null && headNumber === liveNumber;
    const schema = useContentSchema(typeName, headNumber != null && !same);
    const head = useRevisionDetail(
        typeName,
        same ? undefined : entryId,
        headNumber ?? undefined
    );
    const live = useRevisionDetail(
        typeName,
        same || liveNumber == null ? undefined : entryId,
        liveNumber ?? undefined
    );

    if (headNumber == null) {
        return (
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.gone)}
            </p>
        );
    }
    if (same) {
        return (
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.none)}
            </p>
        );
    }

    const loading =
        schema.isPending ||
        head.isPending ||
        (liveNumber != null && live.isPending);
    const failed =
        schema.isError || head.isError || (liveNumber != null && live.isError);

    if (failed) {
        return (
            <p role="alert" className="text-sm text-destructive">
                {intl.formatMessage(messages.failed)}
            </p>
        );
    }
    if (loading || !schema.data || !head.data) {
        return (
            <div
                role="status"
                className="flex items-center gap-2 py-4 text-sm text-muted-foreground"
            >
                <Spinner aria-hidden />
                {intl.formatMessage(messages.loading)}
            </div>
        );
    }

    // `current` is this version and `revision` the live one, in
    // `diffRevision`'s own terms — its baseline is the newer document.
    const changed = diffRevision(
        schema.data,
        head.data.snapshot,
        live.data?.snapshot ?? NOTHING_LIVE
    ).filter((entry) => entry.changed);

    if (!changed.length) {
        return (
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.none)}
            </p>
        );
    }

    const render = (
        diff: RevisionFieldDiff,
        side: 'current' | 'revision'
    ): ReactNode => {
        const detail = side === 'current' ? head.data : live.data;
        if (diff.field.type === CONTENT_FIELD_TYPE.Relation) {
            const refs = detail?.relationRefs?.[diff.field.name] ?? [];
            return (
                <RelationRefList
                    refs={refs}
                    total={
                        detail?.relationTotals?.[diff.field.name] ?? refs.length
                    }
                />
            );
        }
        const assets =
            diff.field.type === CONTENT_FIELD_TYPE.Media
                ? detail?.mediaRefs?.[diff.field.name]
                : undefined;
        if (assets) return <MediaRefList refs={assets} />;
        return formatRevisionValue(
            diff.field,
            side === 'current' ? diff.current : diff.revision,
            intl
        );
    };

    return (
        <div className="overflow-hidden rounded-lg border">
            <Table aria-label={intl.formatMessage(messages.caption)}>
                <TableHeader>
                    <TableRow>
                        <TableHead scope="col" className="w-[28%]">
                            {intl.formatMessage(messages.field)}
                        </TableHead>
                        <TableHead scope="col">
                            {intl.formatMessage(messages.live)}
                        </TableHead>
                        <TableHead scope="col">
                            {intl.formatMessage(messages.current)}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {changed.map((diff) => (
                        <TableRow key={diff.field.name}>
                            <TableHead
                                scope="row"
                                className="align-top font-normal text-foreground"
                            >
                                {fieldLabel(diff.field)}
                            </TableHead>
                            <TableCell className="min-w-0 break-words align-top whitespace-normal">
                                {liveNumber == null ? (
                                    // Nothing was live to strike out.
                                    <span className="text-muted-foreground">
                                        {intl.formatMessage(messages.notLive)}
                                    </span>
                                ) : (
                                    <del className="text-destructive-soft-foreground decoration-destructive">
                                        <span className="sr-only">
                                            {intl.formatMessage(
                                                messages.wasLive
                                            )}{' '}
                                        </span>
                                        {render(diff, 'revision')}
                                    </del>
                                )}
                            </TableCell>
                            <TableCell className="min-w-0 break-words align-top whitespace-normal">
                                <ins className="text-success-soft-foreground no-underline">
                                    <span className="sr-only">
                                        {intl.formatMessage(
                                            messages.isNow
                                        )}{' '}
                                    </span>
                                    {render(diff, 'current')}
                                </ins>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
