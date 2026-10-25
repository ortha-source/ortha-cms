import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import { formatSince } from '../../relativeTime';
import type { AlarmRule, AlarmSummary } from '../../../types/alarm';
import { ALARM_SEVERITIES } from '../../../types/alarm';

const messages = defineMessages({
    error: { id: 'alarms.strip.error', defaultMessage: 'Errors' },
    warn: { id: 'alarms.strip.warn', defaultMessage: 'Warnings' },
    info: { id: 'alarms.strip.info', defaultMessage: 'Info' },
    lastCheck: { id: 'alarms.strip.lastCheck', defaultMessage: 'Last checked' },
    never: { id: 'alarms.strip.never', defaultMessage: 'Not yet' }
});

const DOT = {
    error: 'bg-destructive',
    warn: 'bg-warning',
    info: 'bg-info'
} as const;

type AlarmSummaryStripProps = {
    summary: AlarmSummary | undefined;
    rules: readonly AlarmRule[];
};

/**
 * The page's figures: open findings per severity (the summary the nav badge
 * reads) and when the alarms last checked their collections — the newest
 * `lastScanAt` among them.
 */
export function AlarmSummaryStrip({ summary, rules }: AlarmSummaryStripProps) {
    const intl = useIntl();
    const lastScan = rules
        .map((rule) => rule.lastScanAt)
        .filter((at): at is string => at !== null)
        .sort()
        .at(-1);

    const lastLabel = lastScan
        ? formatSince(intl, lastScan)
        : intl.formatMessage(messages.never);

    return (
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-4 sm:divide-x">
            {ALARM_SEVERITIES.map((severity) => (
                <div key={severity} className="flex flex-col gap-1 px-4 py-3">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span
                            aria-hidden
                            className={cn(
                                'size-1.5 rounded-full',
                                DOT[severity]
                            )}
                        />
                        {intl.formatMessage(messages[severity])}
                    </dt>
                    <dd className="text-[22px] font-semibold leading-7 tabular-nums">
                        {intl.formatNumber(summary?.open[severity] ?? 0)}
                    </dd>
                </div>
            ))}
            <div className="flex flex-col gap-1 px-4 py-3">
                <dt className="text-xs font-medium text-muted-foreground">
                    {intl.formatMessage(messages.lastCheck)}
                </dt>
                <dd className="text-base font-semibold leading-7">
                    {lastLabel}
                </dd>
            </div>
        </dl>
    );
}
