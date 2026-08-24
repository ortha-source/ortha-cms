import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { RecordsColumnCellContext } from '@orthacms/content-admin';
import type { AlarmFinding, AlarmSeverity } from '../../../types/alarm';

const messages = defineMessages({
    none: { id: 'alarms.column.none', defaultMessage: 'Nothing flagged' },
    loading: { id: 'alarms.column.loading', defaultMessage: 'Checking…' },
    failed: { id: 'alarms.column.failed', defaultMessage: 'Not checked' },
    summary: {
        id: 'alarms.column.summary',
        defaultMessage:
            '{count, plural, one {# check flagged} other {# checks flagged}}: {titles}'
    }
});

/** Dot colours, matching {@link SeverityBadge}'s tints. */
const DOTS: Record<AlarmSeverity, string> = {
    error: 'bg-destructive',
    warn: 'bg-amber-500',
    info: 'bg-sky-500'
};

/** Severity order, most severe first. */
const ORDER: readonly AlarmSeverity[] = ['error', 'warn', 'info'];

/**
 * The records table's Checks cell: a dot per severity present, plus a count.
 *
 * Deliberately not a badge per finding — a row is one line and a busy record
 * would push the rest of the table off screen. The colour is never the only
 * signal: the count is text, and the whole cell carries a title listing what
 * was flagged, so the meaning survives both a screen reader and a viewer who
 * cannot tell the three tints apart.
 */
export function AlarmsColumnCell({ entry, data }: RecordsColumnCellContext) {
    const intl = useIntl();
    // `useRowsData` returns the whole query result, so the cell can tell three
    // outcomes apart. "Still loading", "we could not ask" and "nothing flagged"
    // would otherwise all render as an empty cell — and only the last of them
    // is reassuring.
    const result = data as
        | {
              data?: Record<string, AlarmFinding[]>;
              isPending: boolean;
              isError: boolean;
          }
        | undefined;

    if (result?.isPending) {
        return (
            <span className="text-muted-foreground">
                {intl.formatMessage(messages.loading)}
            </span>
        );
    }

    if (result?.isError) {
        return (
            <span className="text-muted-foreground">
                {intl.formatMessage(messages.failed)}
            </span>
        );
    }

    const findings = (result?.data?.[entry.id] ?? []).filter(
        (finding) => finding.state === 'open'
    );

    if (findings.length === 0) {
        return (
            <span className="text-muted-foreground">
                {intl.formatMessage(messages.none)}
            </span>
        );
    }

    const present = ORDER.filter((severity) =>
        findings.some((finding) => finding.severity === severity)
    );
    const label = intl.formatMessage(messages.summary, {
        count: findings.length,
        titles: findings.map((finding) => finding.title).join(', ')
    });

    return (
        <span className="inline-flex items-center gap-1.5" title={label}>
            <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                {present.map((severity) => (
                    <span
                        key={severity}
                        className={cn(
                            'inline-block size-2 rounded-full',
                            DOTS[severity]
                        )}
                    />
                ))}
            </span>
            <span className="tabular-nums">{findings.length}</span>
            <span className="sr-only">{label}</span>
        </span>
    );
}
