import type { ReactNode } from 'react';
import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import { AlertCircle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { Badge, Checkbox, TableCell, cn } from '@orthacms/design-system';
import {
    BULK_VERDICT,
    entryStatusView,
    ENTRY_STATUS_VIEW_LABEL,
    type BulkPublishVerdict
} from '@orthacms/content-admin';
import { isPublishable, type PublishCell } from '../../../../../domain/types';
import type { PublishOutcome } from '../../../../../application/usePublishRun';
import type {
    PublishAnnotation,
    PublishAnnotationTone
} from '../../../../slots/publishingSlots';

const messages = defineMessages({
    pick: {
        id: 'publishing.cell.pick',
        defaultMessage: 'Publish {record}, {axis} ({status})'
    },
    missing: { id: 'publishing.cell.missing', defaultMessage: 'No entry' },
    ready: { id: 'publishing.cell.ready', defaultMessage: 'Ready' },
    blocked: {
        id: 'publishing.cell.blocked',
        defaultMessage: '{count, plural, one {# issue} other {# issues}}'
    },
    alreadyPublished: {
        id: 'publishing.cell.alreadyPublished',
        defaultMessage: 'Already published'
    },
    notFound: {
        id: 'publishing.cell.notFound',
        defaultMessage: 'No longer available'
    },
    published: { id: 'publishing.cell.published', defaultMessage: 'Published' },
    held: {
        id: 'publishing.cell.held',
        defaultMessage: 'Held by a publish rule'
    },
    notPublished: {
        id: 'publishing.cell.notPublished',
        defaultMessage: 'Not published'
    }
});

/** The design-system badge variant per annotation tone. */
const TONE_VARIANT: Record<
    PublishAnnotationTone,
    'outline' | 'success' | 'warning' | 'destructive'
> = {
    neutral: 'outline',
    success: 'success',
    warning: 'warning',
    danger: 'destructive'
};

/** The line a check or a commit leaves under a cell, if any. */
function resultLine(
    intl: IntlShape,
    verdict: BulkPublishVerdict | undefined,
    outcome: PublishOutcome | undefined
): { icon: ReactNode; text: string; danger: boolean } | null {
    if (outcome?.kind === 'published') {
        return {
            icon: (
                <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
            ),
            text: intl.formatMessage(messages.published),
            danger: false
        };
    }
    if (outcome?.kind === 'skipped') {
        return {
            icon: <XCircle className="size-3.5 text-destructive" aria-hidden />,
            text: intl.formatMessage(
                outcome.reason === BULK_VERDICT.GuardRefused
                    ? messages.held
                    : messages.notPublished
            ),
            danger: true
        };
    }
    if (!verdict) return null;
    switch (verdict.verdict) {
        case BULK_VERDICT.Publishable:
            return {
                icon: (
                    <CheckCircle2
                        className="size-3.5 text-primary"
                        aria-hidden
                    />
                ),
                text: intl.formatMessage(messages.ready),
                danger: false
            };
        case BULK_VERDICT.Blocked:
            return {
                icon: (
                    <XCircle
                        className="size-3.5 text-destructive"
                        aria-hidden
                    />
                ),
                text: intl.formatMessage(messages.blocked, {
                    count: verdict.issues.length
                }),
                danger: true
            };
        case BULK_VERDICT.AlreadyPublished:
            return {
                icon: (
                    <MinusCircle
                        className="size-3.5 text-muted-foreground"
                        aria-hidden
                    />
                ),
                text: intl.formatMessage(messages.alreadyPublished),
                danger: false
            };
        default:
            return {
                icon: (
                    <AlertCircle
                        className="size-3.5 text-muted-foreground"
                        aria-hidden
                    />
                ),
                text: intl.formatMessage(messages.notFound),
                danger: false
            };
    }
}

/**
 * One (record, axis) cell of the Publish Manager. Three shapes, by what the
 * axis holds:
 *
 * - **nothing** — a dash; there is no entry to publish;
 * - **live** — its status, stated and not offered (the dry run would only say
 *   "already published");
 * - **draft / modified** — a checkbox with the state beneath it, any notes a
 *   plugin has about the entry (approvals), and, once checked or committed,
 *   what the server said.
 *
 * Everything the cell shows in a badge also reaches its checkbox's accessible
 * name or description, because a column of identical checkboxes told apart
 * only by colour tells a screen-reader user nothing.
 */
export function PublishCellView({
    cell,
    recordName,
    axisLabel,
    picked,
    annotations,
    verdict,
    outcome,
    disabled,
    onToggle
}: {
    cell: PublishCell | undefined;
    recordName: string;
    axisLabel: string;
    picked: boolean;
    annotations: readonly PublishAnnotation[];
    verdict: BulkPublishVerdict | undefined;
    outcome: PublishOutcome | undefined;
    disabled: boolean;
    onToggle: (on: boolean) => void;
}) {
    const intl = useIntl();
    if (!cell) {
        return (
            <TableCell className="text-center text-muted-foreground">
                <span aria-hidden>—</span>
                <span className="sr-only">
                    {intl.formatMessage(messages.missing)}
                </span>
            </TableCell>
        );
    }
    const status = intl.formatMessage(
        ENTRY_STATUS_VIEW_LABEL[entryStatusView(cell)]
    );
    const line = resultLine(intl, verdict, outcome);
    if (!isPublishable(cell)) {
        return (
            <TableCell className="text-center align-top text-xs text-muted-foreground">
                {/* An entry this run just published says so once — its stored
                    status would only repeat the word beside the result. */}
                {line && outcome ? (
                    <span className="inline-flex items-center gap-1">
                        {line.icon}
                        {line.text}
                    </span>
                ) : (
                    status
                )}
            </TableCell>
        );
    }
    const describedBy = `publish-cell-${cell.id}`;
    return (
        <TableCell className="text-center align-top">
            <span className="inline-flex flex-col items-center gap-1">
                <Checkbox
                    checked={picked}
                    disabled={disabled}
                    onCheckedChange={(next) => onToggle(next === true)}
                    aria-label={intl.formatMessage(messages.pick, {
                        record: recordName,
                        axis: axisLabel,
                        status
                    })}
                    aria-describedby={describedBy}
                />
                <span
                    className="text-[11px] leading-none text-muted-foreground"
                    aria-hidden
                >
                    {status}
                </span>
                <span
                    id={describedBy}
                    className="flex flex-col items-center gap-1"
                >
                    {annotations.map((note) => (
                        <Badge
                            key={note.label}
                            variant={TONE_VARIANT[note.tone]}
                            title={note.description}
                            className="whitespace-nowrap px-1.5 py-0 text-[11px] font-normal"
                        >
                            {note.label}
                            {note.description ? (
                                <span className="sr-only">
                                    {' '}
                                    — {note.description}
                                </span>
                            ) : null}
                        </Badge>
                    ))}
                    {line ? (
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 whitespace-nowrap text-[11px]',
                                line.danger
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                            )}
                        >
                            {line.icon}
                            {line.text}
                        </span>
                    ) : null}
                </span>
            </span>
        </TableCell>
    );
}
