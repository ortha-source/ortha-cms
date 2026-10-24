import { defineMessages, useIntl } from 'react-intl';
import { Alert, AlertDescription, AlertTitle } from '@orthacms/design-system';
import { Bell, TriangleAlert } from 'lucide-react';
import { useJustCreated } from '@orthacms/utils-admin';
import { ALARM_RULES_SCOPE } from '../../../application/useAlarmRuleMutations';
import type { AlarmRule } from '../../../types/alarm';
import { RuleCard } from './RuleCard';

const messages = defineMessages({
    errorTitle: {
        id: 'alarms.rules.errorTitle',
        defaultMessage: "Couldn't load alarms"
    },
    errorBody: {
        id: 'alarms.rules.errorBody',
        defaultMessage:
            'The request failed, so this is not a statement that the workspace has no alarms. Try again.'
    },
    emptyTitle: {
        id: 'alarms.rules.emptyTitle',
        defaultMessage: 'No alarms yet'
    },
    emptyBody: {
        id: 'alarms.rules.emptyBody',
        defaultMessage:
            'Filter a content list down to the records that look wrong, then use “Save as alarm” to have the CMS watch for them — or start one from New alarm above.'
    },
    listLabel: { id: 'alarms.rules.listLabel', defaultMessage: 'Alarms' }
});

/** Props for {@link RuleList}. */
export type RuleListProps = {
    /** The rules to render. */
    rules: readonly AlarmRule[];
    /** The request failed — rendered instead of the empty state. */
    isError: boolean;
    /** Whether the caller holds `alarms:manage`. */
    canManage: boolean;
    /** A collection's display label by its name. */
    typeLabel: (name: string) => string;
    /** Re-run this rule across its collection. */
    onRescan: (rule: AlarmRule) => void;
    /** Open this rule for editing. */
    onEdit: (rule: AlarmRule) => void;
    /** Delete this rule. */
    onDelete: (rule: AlarmRule) => void;
    /** Switch this rule on or off. */
    onToggle: (rule: AlarmRule, enabled: boolean) => void;
    /** Show this rule's findings. */
    onShowFindings: (rule: AlarmRule) => void;
    /** Ids of rules with a rescan in flight. */
    rescanningIds: ReadonlySet<string>;
    /** Rules with an on/off change in flight, and the value it is going to. */
    pendingToggles: ReadonlyMap<string, boolean>;
};

/**
 * The workspace's alarms, one card each, in the API's order (by name).
 *
 * As with the findings list, `isError` gets its own state: "no rules" and
 * "could not load the rules" both render as nothing, and only one of them means
 * the workspace is unwatched.
 */
export function RuleList({
    rules,
    isError,
    canManage,
    typeLabel,
    onRescan,
    onEdit,
    onDelete,
    onToggle,
    onShowFindings,
    rescanningIds,
    pendingToggles
}: RuleListProps) {
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

    if (rules.length === 0) {
        return (
            <Alert>
                <Bell aria-hidden="true" />
                <AlertTitle>
                    {intl.formatMessage(messages.emptyTitle)}
                </AlertTitle>
                <AlertDescription>
                    {intl.formatMessage(messages.emptyBody)}
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <ul
            className="flex flex-col gap-3"
            aria-label={intl.formatMessage(messages.listLabel)}
        >
            {rules.map((rule) => (
                <RuleCard
                    key={rule.id}
                    rule={rule}
                    typeLabel={typeLabel(rule.contentType)}
                    canManage={canManage}
                    isRescanning={rescanningIds.has(rule.id)}
                    pendingEnabled={pendingToggles.get(rule.id)}
                    onRescan={onRescan}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggle={onToggle}
                    onShowFindings={onShowFindings}
                    justCreated={isJustCreated(rule.id)}
                />
            ))}
        </ul>
    );
}
