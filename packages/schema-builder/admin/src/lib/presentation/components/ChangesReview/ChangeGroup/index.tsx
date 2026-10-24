import { defineMessages, useIntl } from 'react-intl';
import { FileText, Table2 } from 'lucide-react';
import { Badge, cn } from '@orthacms/design-system';
import type { ClassifiedChange, Safety } from '@orthacms/schema-builder-domain';
import { ChangeRow } from '../ChangeRow';

const messages = defineMessages({
    safe: { id: 'schemaBuilder.safety.safe', defaultMessage: 'Safe' },
    data: { id: 'schemaBuilder.safety.data', defaultMessage: 'Check data' },
    destructive: {
        id: 'schemaBuilder.safety.destructive',
        defaultMessage: 'Deletes data'
    },
    blocked: {
        id: 'schemaBuilder.safety.blocked',
        defaultMessage: 'Not applied'
    },
    newCollection: {
        id: 'schemaBuilder.review.newCollection',
        defaultMessage: 'New collection'
    },
    newSingle: {
        id: 'schemaBuilder.review.newPage',
        defaultMessage: 'New page'
    },
    removed: { id: 'schemaBuilder.review.removed', defaultMessage: 'Removed' }
});

const VARIANT = {
    safe: 'success',
    data: 'warning',
    destructive: 'destructive-soft',
    blocked: 'outline'
} as const;

/** Worst first: the group's badge is its riskiest change. */
const RISK: readonly Safety[] = ['blocked', 'destructive', 'data', 'safe'];

export type ReviewType = { label: string; kind: 'collection' | 'single' };

type Props = {
    name: string;
    type: ReviewType | undefined;
    changes: readonly ClassifiedChange[];
    confirmed: ReadonlySet<string>;
    onToggle: (id: string) => void;
};

/**
 * The changes to one type, as one card: the type, whether it is new or going
 * away, and its riskiest verdict — then each change. A card that deletes data
 * is drawn in the destructive tone, so it is not one row among many.
 */
export function ChangeGroup({
    name,
    type,
    changes,
    confirmed,
    onToggle
}: Props) {
    const intl = useIntl();
    const risk =
        RISK.find((safety) => changes.some((item) => item.safety === safety)) ??
        'safe';
    const added = changes.some((item) => item.change.kind === 'type.add');
    const removed = changes.some((item) => item.change.kind === 'type.remove');
    const Icon = type?.kind === 'single' ? FileText : Table2;
    const headingId = `review-type-${name}`;
    return (
        <section
            aria-labelledby={headingId}
            className={cn(
                'overflow-hidden rounded-xl border bg-card shadow-xs',
                risk === 'destructive' && 'border-destructive/40'
            )}
        >
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                <h2 id={headingId} className="text-sm font-semibold">
                    {type?.label ?? name}
                </h2>
                {added && (
                    <Badge variant="info" className="font-normal">
                        {intl.formatMessage(
                            type?.kind === 'single'
                                ? messages.newSingle
                                : messages.newCollection
                        )}
                    </Badge>
                )}
                {removed && (
                    <Badge variant="muted" className="font-normal">
                        {intl.formatMessage(messages.removed)}
                    </Badge>
                )}
                <Badge variant={VARIANT[risk]} className="ml-auto font-normal">
                    {intl.formatMessage(messages[risk])}
                </Badge>
            </div>
            <ul>
                {changes.map((item) => (
                    <ChangeRow
                        key={item.id}
                        item={item}
                        confirmed={confirmed.has(item.id)}
                        onToggle={onToggle}
                    />
                ))}
            </ul>
        </section>
    );
}
