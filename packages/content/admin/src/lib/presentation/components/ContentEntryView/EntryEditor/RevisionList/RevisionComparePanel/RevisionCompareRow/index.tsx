import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { fieldLabel } from '../../../../../../../domain/entryColumns';
import { CONTENT_FIELD_TYPE } from '../../../../../../../domain/constants';
import type { RevisionFieldDiff } from '../../../../../../../domain/revisionDiff';
import { formatRevisionValue } from '../../RevisionPreviewDialog/formatRevisionValue';
import { MediaRefList } from '../../RevisionPreviewDialog/MediaRefList';
import { RelationRefList } from '../../RevisionPreviewDialog/RelationRefList';
import type {
    DiffMediaRefs,
    DiffRelationRefs
} from '../../RevisionPreviewDialog/RevisionDiffRow';

const messages = defineMessages({
    then: { id: 'content.revisions.compareThen', defaultMessage: 'v{n}' },
    now: { id: 'content.revisions.compareNow', defaultMessage: 'Now' },
    was: {
        id: 'content.revisions.compareWas',
        defaultMessage: 'In version {n}:'
    },
    is: { id: 'content.revisions.compareIs', defaultMessage: 'Now:' }
});

/**
 * One changed field in the History comparison: its label, then how it went
 * from the selected version to the current draft — the version's value struck
 * through, the current one after it. A value that is a list of records or
 * assets is shown as two short lists instead, each named, since striking out
 * a thumbnail says nothing.
 *
 * The strike and the tint are `<del>` / `<ins>`, so the change is stated to a
 * screen reader as well as drawn, with a hidden lead-in naming each side.
 */
export function RevisionCompareRow({
    diff,
    revisionNumber,
    refs,
    media
}: {
    diff: RevisionFieldDiff;
    revisionNumber: number;
    refs?: DiffRelationRefs;
    media?: DiffMediaRefs;
}) {
    const intl = useIntl();
    const isRelation = diff.field.type === CONTENT_FIELD_TYPE.Relation;
    const isMedia = diff.field.type === CONTENT_FIELD_TYPE.Media;

    const render = (side: 'current' | 'revision'): ReactNode => {
        if (isRelation) {
            const list = refs?.[side] ?? [];
            const total =
                (side === 'current'
                    ? refs?.currentTotal
                    : refs?.revisionTotal) ?? list.length;
            return <RelationRefList refs={list} total={total} />;
        }
        const assets = isMedia ? media?.[side] : undefined;
        if (assets) return <MediaRefList refs={assets} />;
        return formatRevisionValue(
            diff.field,
            side === 'current' ? diff.current : diff.revision,
            intl
        );
    };

    const lists = isRelation || isMedia;

    return (
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 border-t px-4 py-3.5 text-[13px] leading-5 first:border-t-0 sm:grid-cols-[140px_minmax(0,1fr)]">
            <span className="text-muted-foreground">
                {fieldLabel(diff.field)}
            </span>
            {lists ? (
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-w-0 gap-2">
                        <span className="w-10 shrink-0 text-xs text-muted-foreground">
                            {intl.formatMessage(messages.then, {
                                n: revisionNumber
                            })}
                        </span>
                        <div className="min-w-0 flex-1">
                            {render('revision')}
                        </div>
                    </div>
                    <div className="flex min-w-0 gap-2">
                        <span className="w-10 shrink-0 text-xs text-muted-foreground">
                            {intl.formatMessage(messages.now)}
                        </span>
                        <div className="min-w-0 flex-1">
                            {render('current')}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="min-w-0 break-words">
                    <del className="rounded-[3px] bg-destructive-soft px-0.5 text-destructive-soft-foreground">
                        <span className="sr-only">
                            {intl.formatMessage(messages.was, {
                                n: revisionNumber
                            })}{' '}
                        </span>
                        {render('revision')}
                    </del>{' '}
                    <ins className="rounded-[3px] bg-success-soft px-0.5 text-success-soft-foreground no-underline">
                        <span className="sr-only">
                            {intl.formatMessage(messages.is)}{' '}
                        </span>
                        {render('current')}
                    </ins>
                </div>
            )}
        </div>
    );
}
