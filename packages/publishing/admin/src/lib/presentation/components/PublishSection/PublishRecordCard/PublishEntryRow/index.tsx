import type { ReactNode } from 'react';
import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import { AlertCircle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { Badge, Checkbox, Spinner, cn } from '@orthacms/design-system';
import {
    BULK_VERDICT,
    entryStatusView,
    EntryStatusBadge,
    ENTRY_STATUS_VIEW_LABEL,
    type BulkPublishVerdict
} from '@orthacms/content-admin';
import {
    isPublishable,
    type PublishAxis,
    type PublishCell
} from '../../../../../domain/types';
import type { PublishOutcome } from '../../../../../application/usePublishRun';
import type {
    PublishAnnotation,
    PublishAnnotationTone
} from '../../../../slots/publishingSlots';
import { FieldChecklist } from './FieldChecklist';

const messages = defineMessages({
    pick: {
        id: 'publishing.cell.pick',
        defaultMessage: 'Publish {record}, {axis} ({status})'
    },
    checking: { id: 'publishing.cell.checking', defaultMessage: 'Checking…' },
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
    },
    entryName: {
        id: 'publishing.cell.entryName',
        defaultMessage: '{record}, {axis}'
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

/** What a check or a commit says about the entry, if anything yet. */
function resultLine(
    intl: IntlShape,
    verdict: BulkPublishVerdict | undefined,
    outcome: PublishOutcome | undefined,
    checking: boolean
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
    if (!verdict) {
        return checking
            ? {
                  icon: <Spinner className="size-3.5" aria-hidden />,
                  text: intl.formatMessage(messages.checking),
                  danger: false
              }
            : null;
    }
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
 * One entry of a record — one locale of a translation group, or the single
 * entry of a type without locales — as a row: a checkbox when it has something
 * to publish, the language, the publish state, any notes a plugin has about it
 * (approvals), what the dry run says, and **its own field checklist**: the
 * failing fields always, every field on demand.
 *
 * A row per locale, stacked, rather than a column per locale: the page stays
 * one column wide however many languages the deployment runs, and each locale
 * has room to say what it is missing.
 */
export function PublishEntryRow({
    cell,
    recordName,
    axis,
    picked,
    annotations,
    verdict,
    outcome,
    checking,
    disabled,
    localizedFields,
    onToggle
}: {
    cell: PublishCell;
    recordName: string;
    axis: PublishAxis;
    picked: boolean;
    annotations: readonly PublishAnnotation[];
    verdict: BulkPublishVerdict | undefined;
    outcome: PublishOutcome | undefined;
    /** A check is running for the set. */
    checking: boolean;
    disabled: boolean;
    localizedFields: ReadonlySet<string>;
    onToggle: (on: boolean) => void;
}) {
    const intl = useIntl();
    const option = isPublishable(cell);
    const line = resultLine(
        intl,
        option ? verdict : undefined,
        outcome,
        option && checking
    );
    const describedBy = `publish-entry-${cell.id}`;
    const entryName = intl.formatMessage(messages.entryName, {
        record: recordName,
        axis: axis.label
    });
    return (
        <li className="flex flex-col gap-1 py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex size-4 shrink-0 items-center">
                    {option ? (
                        <Checkbox
                            checked={picked}
                            disabled={disabled}
                            onCheckedChange={(next) => onToggle(next === true)}
                            aria-label={intl.formatMessage(messages.pick, {
                                record: recordName,
                                axis: axis.label,
                                status: intl.formatMessage(
                                    ENTRY_STATUS_VIEW_LABEL[
                                        entryStatusView(cell)
                                    ]
                                )
                            })}
                            aria-describedby={describedBy}
                        />
                    ) : null}
                </span>
                <span className="flex min-w-40 items-center gap-2 text-sm">
                    {axis.code ? (
                        <span className="w-10 font-mono text-xs uppercase text-muted-foreground">
                            {axis.code}
                        </span>
                    ) : null}
                    <span>{axis.label}</span>
                </span>
                <span
                    id={describedBy}
                    className="flex flex-wrap items-center gap-2"
                >
                    <EntryStatusBadge entry={cell} />
                    {annotations.map((note) => (
                        <Badge
                            key={note.label}
                            variant={TONE_VARIANT[note.tone]}
                            title={note.description}
                            className="whitespace-nowrap font-normal"
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
                                'inline-flex items-center gap-1 whitespace-nowrap text-xs',
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
            </div>
            {option && verdict && !outcome ? (
                <FieldChecklist
                    entryName={entryName}
                    checks={verdict.checks}
                    localizedFields={localizedFields}
                />
            ) : null}
        </li>
    );
}
