import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Switch,
    cn
} from '@orthacms/design-system';
import { jsonFilterToTree } from '@orthacms/query-builder-admin';
import { Ellipsis, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useConditionFields } from '../../../../application/useConditionFields';
import type { AlarmRule } from '../../../../types/alarm';
import { brokenFieldOf } from '../../../../utils/brokenReason';
import { humanizeFieldId } from '../../../../utils/conditions';
import { formatSince } from '../../../relativeTime';
import { Callout } from '../../Callout';
import { ConditionChips } from '../../ConditionChips';
import { SeverityBadge } from '../../SeverityBadge';

const messages = defineMessages({
    flagged: {
        id: 'alarms.rule.flagged',
        defaultMessage: '<b>{count, number}</b> flagged'
    },
    flaggedLabel: {
        id: 'alarms.rule.flaggedLabel',
        defaultMessage: '{count, number} flagged by “{name}” — show them'
    },
    nothingFlagged: {
        id: 'alarms.rule.nothingFlagged',
        defaultMessage: 'Nothing flagged'
    },
    checked: { id: 'alarms.rule.checked', defaultMessage: 'checked {when}' },
    checkedNever: {
        id: 'alarms.rule.checkedNever',
        defaultMessage: 'checked never'
    },
    toggle: {
        id: 'alarms.rule.toggle',
        defaultMessage: 'Alarm “{name}” on'
    },
    brokenField: {
        id: 'alarms.rule.brokenField',
        defaultMessage:
            '“{field}” no longer exists on {type} — fix the condition.'
    },
    brokenOther: {
        id: 'alarms.rule.brokenOther',
        defaultMessage:
            'This condition no longer works on {type} ({reason}) — fix the condition.'
    },
    more: {
        id: 'alarms.rule.more',
        defaultMessage: 'More actions for “{name}”'
    },
    edit: { id: 'alarms.rule.edit', defaultMessage: 'Edit' },
    recheck: { id: 'alarms.rule.recheck', defaultMessage: 'Re-check' },
    remove: { id: 'alarms.rule.remove', defaultMessage: 'Delete' }
});

/** Props for {@link RuleCard}. */
export type RuleCardProps = {
    /** The rule this card is about. */
    rule: AlarmRule;
    /** The collection's display label ("Articles"). */
    typeLabel: string;
    /** Whether the caller holds `alarms:manage`. */
    canManage: boolean;
    /** A rescan of this rule is in flight. */
    isRescanning: boolean;
    /** An on/off change of this rule is in flight, towards this value. */
    pendingEnabled?: boolean;
    onRescan: (rule: AlarmRule) => void;
    onEdit: (rule: AlarmRule) => void;
    onDelete: (rule: AlarmRule) => void;
    onToggle: (rule: AlarmRule, enabled: boolean) => void;
    onShowFindings: (rule: AlarmRule) => void;
    /** The rule was just created — its card is highlighted. */
    justCreated?: boolean;
};

/**
 * One alarm on the Alarms tab: its level, its name and collection, its
 * condition as chips, how much it flags, when it last checked, and an on/off
 * switch.
 *
 * **The condition is readable at rest.** It renders as the same chips the
 * records filter and the editor use, so "what does this alarm look for?" is
 * answered on the list rather than behind an Edit click.
 *
 * **The switch pauses instead of deleting.** Turning an alarm off keeps it,
 * its wording and its history, where the next person can see the decision;
 * deleting it to make it quiet threw all of that away. Turning it back on
 * rescans the collection server-side, so it reports on today.
 *
 * **Broken says so, inline.** A rule whose stored condition stopped parsing is
 * not evaluated, and looks exactly like one that found nothing — so the card
 * names the field that went missing and what to do about it (`alarms:I-08`).
 */
export function RuleCard({
    rule,
    typeLabel,
    canManage,
    isRescanning,
    pendingEnabled,
    onRescan,
    onEdit,
    onDelete,
    onToggle,
    onShowFindings,
    justCreated = false
}: RuleCardProps) {
    const intl = useIntl();
    const { fields } = useConditionFields(rule.contentType);
    // Parsed once per stored filter; the tree's ids are minted fresh on each
    // parse, so re-parsing per render would re-key every chip.
    const tree = useMemo(
        () => jsonFilterToTree(JSON.stringify(rule.filter)),
        [rule.filter]
    );
    const enabled = pendingEnabled ?? rule.enabled;
    const brokenField = brokenFieldOf(rule.brokenReason);

    return (
        <li
            className={cn(
                'flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5',
                justCreated && 'ds-flash'
            )}
        >
            <SeverityBadge severity={rule.severity} className="mt-0.5" />

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="min-w-0 text-sm">
                    <span className="font-semibold">{rule.name}</span>{' '}
                    <span className="text-xs text-muted-foreground">
                        · {typeLabel}
                    </span>
                </p>
                <ConditionChips tree={tree} fields={fields} />
                {rule.brokenReason ? (
                    <Callout tone="warn" className="mt-1 max-w-xl">
                        {brokenField
                            ? intl.formatMessage(messages.brokenField, {
                                  field: humanizeFieldId(brokenField),
                                  type: typeLabel
                              })
                            : intl.formatMessage(messages.brokenOther, {
                                  type: typeLabel,
                                  reason: rule.brokenReason
                              })}
                    </Callout>
                ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                {rule.openCount > 0 ? (
                    <button
                        type="button"
                        onClick={() => onShowFindings(rule)}
                        aria-label={intl.formatMessage(messages.flaggedLabel, {
                            count: rule.openCount,
                            name: rule.name
                        })}
                        className="rounded-sm text-sm underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {intl.formatMessage(messages.flagged, {
                            count: rule.openCount,
                            b: (chunks) => (
                                <b className="font-semibold tabular-nums">
                                    {chunks}
                                </b>
                            )
                        })}
                    </button>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.nothingFlagged)}
                    </span>
                )}
                <span className="text-xs text-muted-foreground">
                    {rule.lastScanAt
                        ? intl.formatMessage(messages.checked, {
                              when: formatSince(intl, rule.lastScanAt)
                          })
                        : intl.formatMessage(messages.checkedNever)}
                </span>
            </div>

            <Switch
                className="mt-0.5"
                checked={enabled}
                // Read-only callers still see the state — whether an alarm is
                // watching is a fact everyone who can read it is owed.
                disabled={!canManage || pendingEnabled !== undefined}
                aria-label={intl.formatMessage(messages.toggle, {
                    name: rule.name
                })}
                onCheckedChange={(next) => onToggle(rule, next)}
            />

            {canManage ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="-mr-1 size-7"
                            aria-label={intl.formatMessage(messages.more, {
                                name: rule.name
                            })}
                        >
                            <Ellipsis aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(rule)}>
                            <Pencil aria-hidden="true" />
                            {intl.formatMessage(messages.edit)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={isRescanning}
                            onSelect={() => onRescan(rule)}
                        >
                            <RefreshCw aria-hidden="true" />
                            {intl.formatMessage(messages.recheck)}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => onDelete(rule)}
                        >
                            <Trash2 aria-hidden="true" />
                            {intl.formatMessage(messages.remove)}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null}
        </li>
    );
}
