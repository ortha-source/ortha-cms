import { defineMessages, useIntl } from 'react-intl';
import { Alert, AlertDescription, AlertTitle } from '@orthacms/design-system';
import { BellOff, CircleCheck, TriangleAlert } from 'lucide-react';
import { useJustCreated } from '@orthacms/utils-admin';
import { ALARM_RULES_SCOPE } from '../../../application/useAlarmRuleMutations';
import type { AlarmRule } from '../../../types/alarm';
import { AlarmsEmpty } from '../AlarmsEmpty';
import { FindingGroup } from './FindingGroup';

const messages = defineMessages({
    errorTitle: {
        id: 'alarms.findings.errorTitle',
        defaultMessage: "Couldn't load findings"
    },
    errorBody: {
        id: 'alarms.findings.errorBody',
        defaultMessage:
            'The request failed. Nothing here reflects the current state of your content until it succeeds.'
    },
    emptyOpenTitle: {
        id: 'alarms.findings.emptyOpenTitle',
        defaultMessage: 'Nothing is flagged'
    },
    emptyOpenBody: {
        id: 'alarms.findings.emptyOpenBody',
        defaultMessage:
            'No record currently matches any of this workspace’s alarms. This is what a clean workspace looks like.'
    },
    noAlarmsTitle: {
        id: 'alarms.findings.noAlarmsTitle',
        defaultMessage: 'No alarms yet'
    },
    noAlarmsBody: {
        id: 'alarms.findings.noAlarmsBody',
        defaultMessage:
            'An alarm watches a collection and flags whatever matches its conditions. Filter a content list down to the records that look wrong and use “Save as alarm”, or start one here.'
    }
});

/** Severity order for the groups: loudest first. */
const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 } as const;

/** Props for {@link FindingGroupList}. */
export type FindingGroupListProps = {
    /** Every alarm in the workspace, with its live counts. */
    rules: readonly AlarmRule[];
    /** The rules request failed — rendered instead of an empty state. */
    isError: boolean;
    /** Whether the caller may rescan (i.e. holds `alarms:manage`). */
    canManage: boolean;
    /** A collection's display label by its name. */
    typeLabel: (name: string) => string;
    /** Re-run one alarm over its whole collection. */
    onRescan: (rule: AlarmRule) => void;
    /** Ids of alarms with a rescan in flight. */
    rescanningIds: ReadonlySet<string>;
    /** Start a new alarm — offered from the "no alarms yet" state. */
    onCreate?: () => void;
    /** Expand this alarm's group on arrival (from an alarm card's count). */
    focusRuleId?: string;
};

/**
 * The Flagged view: one collapsible group per alarm that has records, worst
 * first.
 *
 * **The groups come from the alarms, not from a page of findings.** Each alarm
 * row already carries its own `openCount`, so the list of groups and the
 * number on each header are exact without reading a single finding
 * (`alarms:I-29`) — grouping a *page* of findings client-side would have
 * produced headers describing whichever rows happened to come back.
 *
 * **Only alarms with something to show are rendered.** An alarm sitting at zero
 * belongs on the Alarms tab; here it would be a row that exists to say nothing.
 */
export function FindingGroupList({
    rules,
    isError,
    canManage,
    typeLabel,
    onRescan,
    rescanningIds,
    onCreate,
    focusRuleId
}: FindingGroupListProps) {
    const intl = useIntl();
    const isJustCreated = useJustCreated(ALARM_RULES_SCOPE);

    if (isError) {
        return (
            <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>
                    {intl.formatMessage(messages.errorTitle)}
                </AlertTitle>
                <AlertDescription>
                    {intl.formatMessage(messages.errorBody)}
                </AlertDescription>
            </Alert>
        );
    }

    const groups = rules
        .filter((rule) => rule.openCount > 0)
        // Loudest first, then biggest: an editor scanning this wants the errors
        // and the pile-ups at the top, not whatever the API happened to sort by.
        .slice()
        .sort((a, b) => {
            if (SEVERITY_ORDER[a.severity] !== SEVERITY_ORDER[b.severity]) {
                return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
            }
            return b.openCount - a.openCount;
        });

    if (groups.length === 0) {
        // "No alarms at all" and "alarms exist and nothing matches" are
        // different facts, and only the second is reassuring.
        if (rules.length === 0) {
            return (
                <AlarmsEmpty
                    icon={BellOff}
                    title={intl.formatMessage(messages.noAlarmsTitle)}
                    description={intl.formatMessage(messages.noAlarmsBody)}
                    onCreate={onCreate}
                />
            );
        }
        return (
            <AlarmsEmpty
                icon={CircleCheck}
                title={intl.formatMessage(messages.emptyOpenTitle)}
                description={intl.formatMessage(messages.emptyOpenBody)}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {groups.map((rule, index) => (
                <FindingGroup
                    key={rule.id}
                    rule={rule}
                    typeLabel={typeLabel(rule.contentType)}
                    count={rule.openCount}
                    // The worst group opens on arrival — the board's "each
                    // alarm, its records": the page leads with the records that
                    // matter most, and the rest are a summary to drill into.
                    // An alarm card's "N flagged" opens its own group instead.
                    defaultOpen={
                        focusRuleId ? rule.id === focusRuleId : index === 0
                    }
                    canManage={canManage}
                    onRescan={onRescan}
                    isRescanning={rescanningIds.has(rule.id)}
                    justCreated={isJustCreated(rule.id)}
                />
            ))}
        </div>
    );
}
