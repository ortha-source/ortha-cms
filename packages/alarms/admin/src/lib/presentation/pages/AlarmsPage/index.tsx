import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    ConfirmDialog,
    Container,
    ContainerHeader,
    SegmentedControl,
    SegmentedControlCount,
    SegmentedControlItem,
    toast
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { PageTopBar } from '@orthacms/shell-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { BellRing, Plus } from 'lucide-react';
import { useAlarmFindings } from '../../../application/useAlarmFindings';
import { useAlarmRules } from '../../../application/useAlarmRules';
import { useAlarmSummary } from '../../../application/useAlarmSummary';
import {
    useDeleteAlarmRule,
    useRescanAlarmRule
} from '../../../application/useAlarmRuleMutations';
import {
    useMuteFinding,
    useUnmuteFinding
} from '../../../application/useMuteFinding';
import type { AlarmFinding, AlarmRule } from '../../../types/alarm';
import { AlarmsNoAccess } from '../../components/AlarmsNoAccess';
import { AlarmsSkeleton } from '../../components/AlarmsSkeleton';
import { FindingList } from '../../components/FindingList';
import { MuteFindingDialog } from '../../components/MuteFindingDialog';
import { RuleList } from '../../components/RuleList';

const messages = defineMessages({
    title: { id: 'alarms.page.title', defaultMessage: 'Alarms' },
    subtitle: {
        id: 'alarms.page.subtitle',
        defaultMessage:
            'Rules that watch this workspace’s content. They flag problems; they never block a save or a publish.'
    },
    tabOpen: { id: 'alarms.page.tabOpen', defaultMessage: 'Flagged' },
    tabMuted: { id: 'alarms.page.tabMuted', defaultMessage: 'Muted' },
    // "Alarms" rather than "Rules": the object a person creates here is an
    // alarm, and "rule" meant nothing outside this page — the records
    // toolbar's button was the complaint that surfaced it. It repeats the
    // section name, which is mild and unambiguous: the tab lists the alarms.
    tabRules: { id: 'alarms.page.tabRules', defaultMessage: 'Alarms' },
    tabsLabel: { id: 'alarms.page.tabsLabel', defaultMessage: 'Alarms view' },
    crumb: { id: 'alarms.page.crumb', defaultMessage: 'Alarms' },
    newAlarm: { id: 'alarms.page.newAlarm', defaultMessage: 'New alarm' },
    clearRule: {
        id: 'alarms.page.clearRule',
        defaultMessage: 'Showing {ruleName} only — show everything'
    },
    muted: { id: 'alarms.page.muted', defaultMessage: 'Muted on this record.' },
    unmuted: { id: 'alarms.page.unmuted', defaultMessage: 'Unmuted.' },
    rescanned: {
        id: 'alarms.page.rescanned',
        defaultMessage:
            '{name}: checked {scanned}, {open, plural, =0 {nothing flagged} one {# flagged} other {# flagged}}, {resolved} cleared.'
    },
    rescanFailed: {
        id: 'alarms.page.rescanFailed',
        defaultMessage: 'The check failed: {reason}'
    },
    deleteTitle: {
        id: 'alarms.page.deleteTitle',
        defaultMessage: 'Delete this alarm?'
    },
    deleteBody: {
        id: 'alarms.page.deleteBody',
        defaultMessage:
            '“{name}” and everything it has flagged will be removed. Records themselves are untouched.'
    },
    deleteConfirm: {
        id: 'alarms.page.deleteConfirm',
        defaultMessage: 'Delete alarm'
    },
    deleted: { id: 'alarms.page.deleted', defaultMessage: 'Alarm deleted.' },
    prev: { id: 'alarms.page.prev', defaultMessage: 'Previous' },
    next: { id: 'alarms.page.next', defaultMessage: 'Next' },
    pageOf: {
        id: 'alarms.page.pageOf',
        defaultMessage: 'Page {page} of {pages}'
    }
});

/** Which of the three views the page is showing. */
type AlarmsTab = 'open' | 'muted' | 'rules';

const PAGE_SIZE = 25;

/**
 * The workspace's alarms: what is flagged, what has been silenced, and the
 * rules behind both.
 *
 * Findings are grouped **by rule** rather than by record, because that is how
 * they get fixed — an editor handed "fourteen articles link to a draft author"
 * does one pass, while fourteen separate rows about fourteen articles is
 * fourteen context switches.
 */
export function AlarmsPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const workspace = useCurrentWorkspace();
    const canRead = useHasPermission('alarms:read');
    const canManage = useHasPermission('alarms:manage');

    const [tab, setTab] = useState<AlarmsTab>('open');
    const [page, setPage] = useState(1);
    const [ruleFilter, setRuleFilter] = useState<AlarmRule | null>(null);
    const [pendingDelete, setPendingDelete] = useState<AlarmRule | null>(null);
    const [pendingMute, setPendingMute] = useState<AlarmFinding | null>(null);
    const [rescanning, setRescanning] = useState<ReadonlySet<string>>(
        () => new Set()
    );

    const summary = useAlarmSummary(canRead);
    const rules = useAlarmRules(canRead);
    const findings = useAlarmFindings(
        {
            state: tab === 'rules' ? undefined : tab,
            ruleId: ruleFilter?.id,
            page,
            pageSize: PAGE_SIZE
        },
        canRead && tab !== 'rules'
    );

    const mute = useMuteFinding();
    const unmute = useUnmuteFinding();
    const rescan = useRescanAlarmRule();
    const remove = useDeleteAlarmRule();

    const pageCount = useMemo(
        () => Math.max(1, Math.ceil((findings.data?.total ?? 0) / PAGE_SIZE)),
        [findings.data?.total]
    );

    // Muting the last row of a trailing page leaves `page` past the end, and the
    // refetch then lands on an empty page with the pager hidden — the user is
    // stranded with no way back. Clamp whenever the total shrinks under us.
    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

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

    const onConfirmMute = (reason: string) => {
        if (!pendingMute) return;
        mute.mutate(
            {
                ruleId: pendingMute.ruleId,
                entryId: pendingMute.entryId,
                reason: reason || undefined
            },
            {
                onSuccess: () => {
                    toast.success(intl.formatMessage(messages.muted));
                    setPendingMute(null);
                }
            }
        );
    };

    const onUnmute = (finding: AlarmFinding) => {
        unmute.mutate(
            { ruleId: finding.ruleId, entryId: finding.entryId },
            {
                onSuccess: () =>
                    toast.success(intl.formatMessage(messages.unmuted))
            }
        );
    };

    const onRescan = (rule: AlarmRule) => {
        setRescanning((current) => new Set(current).add(rule.id));
        rescan.mutate(rule.id, {
            onSuccess: (result) =>
                toast.success(
                    intl.formatMessage(messages.rescanned, {
                        name: rule.name,
                        scanned: result.scanned,
                        open: result.open,
                        resolved: result.resolved
                    })
                ),
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

    const showFindings = (rule: AlarmRule) => {
        setRuleFilter(rule);
        setTab('open');
        setPage(1);
    };

    const openTotal = summary.data?.openTotal ?? 0;
    const mutedTotal = summary.data?.muted ?? 0;

    return (
        <>
            <PageTopBar icon={BellRing} crumbs={crumbs} />
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                    actions={
                        canManage ? (
                            <Button
                                onClick={() =>
                                    navigate(
                                        `/workspaces/${workspace.id}/alarms/rules/new`
                                    )
                                }
                            >
                                <Plus />
                                {intl.formatMessage(messages.newAlarm)}
                            </Button>
                        ) : undefined
                    }
                />

                {/* The page's own vertical rhythm. `Container` sets padding but
                    no gap, and `ContainerHeader`'s `mb-6` is the only margin in
                    play — so without this the tab strip and whatever it selects
                    sat flush against each other and the page read as one
                    undifferentiated block. */}
                <div className="flex flex-col items-stretch gap-6">
                    <SegmentedControl
                        // `self-start`, because a flex column stretches its
                        // children: without it the tab strip spanned the full
                        // width of the page and read as a header band rather
                        // than as three tabs.
                        className="self-start"
                        aria-label={intl.formatMessage(messages.tabsLabel)}
                        value={tab}
                        onValueChange={(next) => {
                            setTab(next as AlarmsTab);
                            setPage(1);
                        }}
                    >
                        <SegmentedControlItem value="open">
                            {intl.formatMessage(messages.tabOpen)}
                            <SegmentedControlCount>
                                {openTotal}
                            </SegmentedControlCount>
                        </SegmentedControlItem>
                        <SegmentedControlItem value="muted">
                            {intl.formatMessage(messages.tabMuted)}
                            <SegmentedControlCount>
                                {mutedTotal}
                            </SegmentedControlCount>
                        </SegmentedControlItem>
                        <SegmentedControlItem value="rules">
                            {intl.formatMessage(messages.tabRules)}
                            <SegmentedControlCount>
                                {rules.data?.length ?? 0}
                            </SegmentedControlCount>
                        </SegmentedControlItem>
                    </SegmentedControl>

                    {tab === 'rules' ? (
                        <RuleList
                            rules={rules.data ?? []}
                            isError={rules.isError}
                            canManage={canManage}
                            rescanningIds={rescanning}
                            onRescan={onRescan}
                            onEdit={(rule) =>
                                navigate(
                                    `/workspaces/${workspace.id}/alarms/rules/${rule.id}`
                                )
                            }
                            onDelete={setPendingDelete}
                            onShowFindings={showFindings}
                        />
                    ) : (
                        <div className="flex flex-col gap-3">
                            {ruleFilter ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="self-start"
                                    onClick={() => {
                                        setRuleFilter(null);
                                        setPage(1);
                                    }}
                                >
                                    {intl.formatMessage(messages.clearRule, {
                                        ruleName: ruleFilter.name
                                    })}
                                </Button>
                            ) : null}

                            <FindingList
                                findings={findings.data?.items ?? []}
                                isError={findings.isError}
                                canManage={canManage}
                                onMute={setPendingMute}
                                onUnmute={onUnmute}
                            />

                            {pageCount > 1 ? (
                                <div className="flex items-center justify-end gap-3">
                                    <span className="text-sm text-muted-foreground tabular-nums">
                                        {intl.formatMessage(messages.pageOf, {
                                            page,
                                            pages: pageCount
                                        })}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage((n) => n - 1)}
                                    >
                                        {intl.formatMessage(messages.prev)}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= pageCount}
                                        onClick={() => setPage((n) => n + 1)}
                                    >
                                        {intl.formatMessage(messages.next)}
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

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

                <MuteFindingDialog
                    finding={pendingMute}
                    isPending={mute.isPending}
                    onCancel={() => setPendingMute(null)}
                    onConfirm={onConfirmMute}
                />
            </Container>
        </>
    );
}
