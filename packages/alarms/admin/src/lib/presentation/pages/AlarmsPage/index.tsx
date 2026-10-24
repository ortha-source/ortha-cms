import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    ConfirmDialog,
    Container,
    ContainerHeader,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    toast
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { PageActionsPortal, PageTopBar } from '@orthacms/shell-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { BellRing, Plus } from 'lucide-react';
import { useAlarmRules } from '../../../application/useAlarmRules';
import { useAlarmSummary } from '../../../application/useAlarmSummary';
import {
    useDeleteAlarmRule,
    useRescanAlarmRule,
    useUpdateAlarmRule
} from '../../../application/useAlarmRuleMutations';
import { useTypeLabels } from '../../../application/useTypeLabels';
import type { AlarmRule, AlarmScanResult } from '../../../types/alarm';
import { AlarmsNoAccess } from '../../components/AlarmsNoAccess';
import { AlarmsSkeleton } from '../../components/AlarmsSkeleton';
import { FindingGroupList } from '../../components/FindingGroupList';
import { RuleList } from '../../components/RuleList';
import { AlarmSummaryStrip } from '../../components/AlarmSummaryStrip';
import { scanMessage } from '../../scanMessage';

const messages = defineMessages({
    title: { id: 'alarms.page.title', defaultMessage: 'Alarms' },
    subtitle: {
        id: 'alarms.page.subtitle',
        defaultMessage:
            'Rules that watch this workspace’s content. They flag problems — they never block a save or a publish.'
    },
    tabOpen: { id: 'alarms.page.tabOpen', defaultMessage: 'Flagged' },
    // "Alarms" rather than "Rules": the object a person creates here is an
    // alarm, and "rule" meant nothing outside this page.
    tabRules: { id: 'alarms.page.tabRules', defaultMessage: 'Alarms' },
    tabsLabel: { id: 'alarms.page.tabsLabel', defaultMessage: 'Alarms view' },
    crumb: { id: 'alarms.page.crumb', defaultMessage: 'Alarms' },
    newAlarm: { id: 'alarms.page.newAlarm', defaultMessage: 'New alarm' },
    rescanFailed: {
        id: 'alarms.page.rescanFailed',
        defaultMessage: 'The check failed: {reason}'
    },
    turnedOn: {
        id: 'alarms.page.turnedOn',
        defaultMessage: '{name} is on.'
    },
    turnedOff: {
        id: 'alarms.page.turnedOff',
        defaultMessage:
            '{name} is off. It keeps what it flagged and checks nothing new until it is back on.'
    },
    toggleFailed: {
        id: 'alarms.page.toggleFailed',
        defaultMessage: '{name} could not be switched: {reason}'
    },
    deleteTitle: {
        id: 'alarms.page.deleteTitle',
        defaultMessage: 'Delete this alarm?'
    },
    deleteBody: {
        id: 'alarms.page.deleteBody',
        defaultMessage:
            '“{name}” and everything it has flagged will be removed. Records themselves are untouched. To pause it instead, switch it off.'
    },
    deleteConfirm: {
        id: 'alarms.page.deleteConfirm',
        defaultMessage: 'Delete alarm'
    },
    deleted: { id: 'alarms.page.deleted', defaultMessage: 'Alarm deleted.' }
});

/** Which of the two views the page is showing. */
type AlarmsTab = 'open' | 'rules';

/**
 * The workspace's alarms: what the rules found, and the rules themselves.
 *
 * - **Flagged** groups findings **by alarm**, worst first, because that is how
 *   they get fixed — "fourteen articles link to a draft author" is one pass.
 * - **Alarms** lists the rules with their condition as chips and an on/off
 *   switch, so pausing an alarm never means deleting it.
 *
 * The page leads with `ContainerHeader` (the `<h1>`), **New alarm** in the
 * top bar, and the figures strip: open findings per severity and when the
 * alarms last checked.
 */
export function AlarmsPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const workspace = useCurrentWorkspace();
    const canRead = useHasPermission('alarms:read');
    const canManage = useHasPermission('alarms:manage');

    const [tab, setTab] = useState<AlarmsTab>('open');
    // Which alarm's group to open, set by an alarm card's "N flagged". Not a
    // filter: grouping already separates the alarms, so narrowing to one would
    // hide the rest for no gain.
    const [focusRuleId, setFocusRuleId] = useState<string | undefined>();
    const [pendingDelete, setPendingDelete] = useState<AlarmRule | null>(null);
    const [rescanning, setRescanning] = useState<ReadonlySet<string>>(
        () => new Set()
    );
    const [toggling, setToggling] = useState<ReadonlyMap<string, boolean>>(
        () => new Map()
    );

    const summary = useAlarmSummary(canRead);
    const rules = useAlarmRules(canRead);
    const typeLabel = useTypeLabels(canRead);

    const rescan = useRescanAlarmRule();
    const update = useUpdateAlarmRule();
    const remove = useDeleteAlarmRule();

    const crumbs = [
        { key: 'alarms', label: intl.formatMessage(messages.crumb) }
    ];

    if (!canRead) {
        return (
            <>
                <PageTopBar icon={BellRing} crumbs={crumbs} />
                <Container>
                    <ContainerHeader
                        title={intl.formatMessage(messages.title)}
                        subtitle={intl.formatMessage(messages.subtitle)}
                    />
                    <AlarmsNoAccess />
                </Container>
            </>
        );
    }

    if (summary.isPending && rules.isPending) return <AlarmsSkeleton />;

    const reportScan = (rule: AlarmRule, result: AlarmScanResult) =>
        toast.success(scanMessage(intl, rule.name, result));

    const onRescan = (rule: AlarmRule) => {
        setRescanning((current) => new Set(current).add(rule.id));
        rescan.mutate(rule.id, {
            onSuccess: (result) => reportScan(rule, result),
            onError: (error) =>
                toast.error(
                    intl.formatMessage(messages.rescanFailed, {
                        reason: (error as Error).message
                    })
                ),
            onSettled: () =>
                setRescanning((current) => {
                    const next = new Set(current);
                    next.delete(rule.id);
                    return next;
                })
        });
    };

    const onToggle = (rule: AlarmRule, enabled: boolean) => {
        setToggling((current) => new Map(current).set(rule.id, enabled));
        update.mutate(
            { id: rule.id, input: { enabled } },
            {
                onSuccess: (result) => {
                    // Switching on rescans server-side; say what it found,
                    // which is more use than "on".
                    if (result.scan) reportScan(rule, result.scan);
                    else
                        toast.success(
                            intl.formatMessage(
                                enabled ? messages.turnedOn : messages.turnedOff,
                                { name: rule.name }
                            )
                        );
                },
                onError: (error) =>
                    toast.error(
                        intl.formatMessage(messages.toggleFailed, {
                            name: rule.name,
                            reason: (error as Error).message
                        })
                    ),
                onSettled: () =>
                    setToggling((current) => {
                        const next = new Map(current);
                        next.delete(rule.id);
                        return next;
                    })
            }
        );
    };

    const showFindings = (rule: AlarmRule) => {
        setFocusRuleId(rule.id);
        setTab('open');
    };

    const newAlarmPath = `/workspaces/${workspace.id}/alarms/rules/new`;
    const openTotal = summary.data?.openTotal ?? 0;

    return (
        <>
            <PageTopBar icon={BellRing} crumbs={crumbs} />
            {canManage ? (
                <PageActionsPortal>
                    <Button size="sm" onClick={() => navigate(newAlarmPath)}>
                        <Plus aria-hidden="true" />
                        {intl.formatMessage(messages.newAlarm)}
                    </Button>
                </PageActionsPortal>
            ) : null}
            <Container className="flex max-w-[940px] flex-col gap-5">
                <ContainerHeader
                    className="mb-0"
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />

                <AlarmSummaryStrip
                    summary={summary.data}
                    rules={rules.data ?? []}
                />

                <Tabs
                    value={tab}
                    onValueChange={(next) => {
                        setTab(next as AlarmsTab);
                        setFocusRuleId(undefined);
                    }}
                    className="flex flex-col gap-4"
                >
                    <TabsList aria-label={intl.formatMessage(messages.tabsLabel)}>
                        <TabsTrigger value="open">
                            {intl.formatMessage(messages.tabOpen)}{' '}
                            <span className="text-xs font-normal tabular-nums text-muted-foreground">
                                {intl.formatNumber(openTotal)}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="rules">
                            {intl.formatMessage(messages.tabRules)}{' '}
                            <span className="text-xs font-normal tabular-nums text-muted-foreground">
                                {intl.formatNumber(rules.data?.length ?? 0)}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="open">
                        <FindingGroupList
                            rules={rules.data ?? []}
                            isError={rules.isError}
                            canManage={canManage}
                            typeLabel={typeLabel}
                            onRescan={onRescan}
                            rescanningIds={rescanning}
                            onCreate={
                                canManage
                                    ? () => navigate(newAlarmPath)
                                    : undefined
                            }
                            focusRuleId={focusRuleId}
                        />
                    </TabsContent>
                    <TabsContent value="rules">
                        <RuleList
                            rules={rules.data ?? []}
                            isError={rules.isError}
                            canManage={canManage}
                            typeLabel={typeLabel}
                            rescanningIds={rescanning}
                            pendingToggles={toggling}
                            onRescan={onRescan}
                            onEdit={(rule) =>
                                navigate(
                                    `/workspaces/${workspace.id}/alarms/rules/${rule.id}`
                                )
                            }
                            onDelete={setPendingDelete}
                            onToggle={onToggle}
                            onShowFindings={showFindings}
                        />
                    </TabsContent>
                </Tabs>

                <ConfirmDialog
                    open={pendingDelete !== null}
                    onOpenChange={(next) => {
                        if (!next) setPendingDelete(null);
                    }}
                    title={intl.formatMessage(messages.deleteTitle)}
                    description={intl.formatMessage(messages.deleteBody, {
                        name: pendingDelete?.name ?? ''
                    })}
                    confirmLabel={intl.formatMessage(messages.deleteConfirm)}
                    confirmVariant="destructive"
                    onConfirm={() => {
                        if (!pendingDelete) return;
                        remove.mutate(pendingDelete.id, {
                            onSuccess: () =>
                                toast.success(
                                    intl.formatMessage(messages.deleted)
                                )
                        });
                        setPendingDelete(null);
                    }}
                />
            </Container>
        </>
    );
}
