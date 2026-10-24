import { useId, type ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Spinner, cn } from '@orthacms/design-system';
import { Table2 } from 'lucide-react';
import type { AlarmRulePreview, AlarmSeverity } from '../../../types/alarm';
import { inlineTypeLabel, previewVerdict } from '../../../utils/previewVerdict';
import { severityLook } from '../../severityLook';
import { Callout } from '../Callout';

const messages = defineMessages({
    heading: { id: 'alarms.preview.heading', defaultMessage: 'Right now' },
    wouldFlag: {
        id: 'alarms.preview.wouldFlag',
        defaultMessage: 'of {total, number} {type} would be flagged'
    },
    pickType: {
        id: 'alarms.preview.pickType',
        defaultMessage: 'Pick what to watch to see what this alarm would flag.'
    },
    addCondition: {
        id: 'alarms.preview.addCondition',
        defaultMessage: 'Add a condition to see which records it would flag.'
    },
    checking: {
        id: 'alarms.preview.checking',
        defaultMessage: 'Checking how many records match…'
    },
    failed: {
        id: 'alarms.preview.failed',
        defaultMessage: 'Could not count the matches: {reason}'
    },
    inverted: {
        id: 'alarms.preview.inverted',
        defaultMessage:
            'That is every record in {type} — the condition is probably inverted.'
    },
    sampleLabel: {
        id: 'alarms.preview.sampleLabel',
        defaultMessage: 'Some of the records it would flag'
    },
    more: {
        id: 'alarms.preview.more',
        defaultMessage: 'and {more, number} more · updates as you edit'
    },
    live: {
        id: 'alarms.preview.live',
        defaultMessage: 'Updates as you edit'
    },
    editorsHeading: {
        id: 'alarms.preview.editorsHeading',
        defaultMessage: 'Editors will see'
    },
    titlePlaceholder: {
        id: 'alarms.preview.titlePlaceholder',
        defaultMessage: 'What editors will see'
    },
    namePlaceholder: {
        id: 'alarms.preview.namePlaceholder',
        defaultMessage: 'Alarm name'
    },
    byline: {
        id: 'alarms.preview.byline',
        defaultMessage: '{name} · {level}'
    }
});

/** Props for {@link AlarmPreviewPanel}. */
export type AlarmPreviewPanelProps = {
    /** The collection's label, or `''` while none is chosen. */
    typeLabel: string;
    /** There is a collection to count. */
    hasType: boolean;
    /** There is at least one condition to count with. */
    hasCondition: boolean;
    /** The live preview mutation's state. */
    preview: {
        data?: AlarmRulePreview;
        isPending: boolean;
        isError: boolean;
        error: unknown;
    };
    /** What the finding will say on a record (may be blank while typing). */
    findingTitle: string;
    /** The alarm's name (may be blank while typing). */
    name: string;
    severity: AlarmSeverity;
};

/**
 * The editor's right-hand panel: what this alarm would flag **right now**, and
 * what editors will see on a flagged record — before anything is saved.
 *
 * The count is the reason the "New alarm" form is acceptable at all (see the
 * package AGENTS.md): a blank condition form invites an alarm against a
 * collection nobody has looked at, and "842 of 842 — the condition is
 * probably inverted" is what catches it before 842 records get flagged. The
 * sample names a few of the records by title so the author can judge them
 * with their own eyes, which a number alone never lets them do.
 *
 * The count line is a polite live region: it re-runs on its own as the
 * conditions change, and that change has to reach a screen reader as well.
 */
export function AlarmPreviewPanel({
    typeLabel,
    hasType,
    hasCondition,
    preview,
    findingTitle,
    name,
    severity
}: AlarmPreviewPanelProps) {
    const intl = useIntl();
    const headingId = useId();
    const editorsId = useId();
    const typeNoun = inlineTypeLabel(typeLabel);
    const data = hasType && hasCondition ? preview.data : undefined;
    const verdict = data ? previewVerdict(data) : null;
    const look = severityLook(severity);

    let status: ReactNode;
    if (!hasType) {
        status = (
            <span className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.pickType)}
            </span>
        );
    } else if (!hasCondition) {
        status = (
            <span className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.addCondition)}
            </span>
        );
    } else if (preview.isPending) {
        status = (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                {intl.formatMessage(messages.checking)}
            </span>
        );
    } else if (preview.isError) {
        status = (
            <span className="text-sm text-destructive">
                {intl.formatMessage(messages.failed, {
                    reason: (preview.error as Error | undefined)?.message ?? ''
                })}
            </span>
        );
    } else if (data) {
        status = (
            <>
                <b className="text-2xl font-semibold tabular-nums">
                    {intl.formatNumber(data.matched)}
                </b>{' '}
                <span className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.wouldFlag, {
                        total: data.total,
                        type: typeNoun
                    })}
                </span>
            </>
        );
    }

    return (
        <section
            aria-labelledby={headingId}
            className="flex flex-col gap-2.5 rounded-xl border bg-card p-3.5"
        >
            <h2
                id={headingId}
                className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
                {intl.formatMessage(messages.heading)}
            </h2>
            <p aria-live="polite" data-alarm-preview-count>
                {status}
            </p>

            {verdict?.inverted ? (
                <Callout tone="bad" role="status">
                    {intl.formatMessage(messages.inverted, { type: typeNoun })}
                </Callout>
            ) : null}

            {data && data.sample.length > 0 ? (
                <>
                    <ul
                        aria-label={intl.formatMessage(messages.sampleLabel)}
                        className="divide-y overflow-hidden rounded-lg border"
                    >
                        {data.sample.map((entry) => (
                            <li
                                key={entry.id}
                                className="flex min-h-[38px] items-center gap-2.5 px-3 text-sm"
                            >
                                <Table2
                                    aria-hidden="true"
                                    className="size-4 shrink-0 text-muted-foreground"
                                />
                                <span
                                    className={cn(
                                        'min-w-0 truncate',
                                        !entry.title && 'tabular-nums'
                                    )}
                                >
                                    {entry.title ?? entry.id}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                        {verdict && verdict.more > 0
                            ? intl.formatMessage(messages.more, {
                                  more: verdict.more
                              })
                            : intl.formatMessage(messages.live)}
                    </p>
                </>
            ) : null}

            <h3
                id={editorsId}
                className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
                {intl.formatMessage(messages.editorsHeading)}
            </h3>
            {/* The finding as it sits on a record — the level's own tint and
                glyph, so the author sees the weight it will carry. */}
            <div
                aria-labelledby={editorsId}
                role="group"
                className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] leading-5',
                    look.chip
                )}
            >
                <look.Icon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0">
                    <b className="block font-semibold">
                        {findingTitle.trim() ||
                            intl.formatMessage(messages.titlePlaceholder)}
                    </b>
                    {intl.formatMessage(messages.byline, {
                        name:
                            name.trim() ||
                            intl.formatMessage(messages.namePlaceholder),
                        level: intl.formatMessage(look.label)
                    })}
                </span>
            </div>
        </section>
    );
}
