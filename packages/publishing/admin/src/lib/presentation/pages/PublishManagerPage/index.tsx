import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import {
    Button,
    Container,
    ContainerHeader,
    Skeleton,
    SkeletonRegion,
    toast
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { PageTopBar } from '@orthacms/shell-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { BULK_VERDICT, useContentTypes } from '@orthacms/content-admin';
import { CONTENT_PUBLISH } from '../../../domain/constants';
import { parsePublishSet } from '../../../domain/publishSet';
import {
    optionAxes,
    optionBatches,
    PICK_PRESET,
    pickedCells,
    publishBatches,
    reconcilePicks,
    setAxis,
    type Picks
} from '../../../domain/publishPicks';
import { withBlocked } from '../../../domain/publishRecords';
import {
    BASE_AXIS,
    LIVE_STATUS,
    recordTitle,
    type PublishRecord
} from '../../../domain/types';
import { usePublishContext } from '../../../application/usePublishContext';
import { usePublishRun } from '../../../application/usePublishRun';
import { usePublishRecords } from '../../hooks/usePublishRecords';
import { PublishToolbar } from '../../components/PublishToolbar';
import { PublishRecordList } from '../../components/PublishRecordList';
import {
    AttentionList,
    type AttentionEntry
} from '../../components/AttentionList';
import { PublishOutcomeSummary } from '../../components/PublishOutcomeSummary';

/** One empty id list, so a page with no set hands the hooks a stable input. */
const NO_IDS: readonly string[] = [];

const messages = defineMessages({
    title: { id: 'publishing.page.title', defaultMessage: 'Publish Manager' },
    subtitle: {
        id: 'publishing.page.subtitle',
        defaultMessage:
            'Choose what goes live together: the selected records, their translations and the drafts they link to. Nothing publishes until you check and confirm.'
    },
    noSet: {
        id: 'publishing.page.noSet',
        defaultMessage:
            'Nothing to publish here yet. Select records in a collection and choose “Open in Publish Manager”, or open it from a record’s ⋯ menu.'
    },
    forbidden: {
        id: 'publishing.page.forbidden',
        defaultMessage: 'You don’t have permission to publish content.'
    },
    loading: {
        id: 'publishing.page.loading',
        defaultMessage: 'Loading what these records would publish'
    },
    failed: {
        id: 'publishing.page.failed',
        defaultMessage: 'Couldn’t load these records.'
    },
    retry: { id: 'publishing.page.retry', defaultMessage: 'Retry' },
    missing: {
        id: 'publishing.page.missing',
        defaultMessage:
            '{count, plural, one {# selected record is} other {# selected records are}} no longer available and won’t be published.'
    },
    truncated: {
        id: 'publishing.page.truncated',
        defaultMessage:
            'Some records link to more drafts than are listed here. Publish the rest from their own collections.'
    },
    sourceFailed: {
        id: 'publishing.page.sourceFailed',
        defaultMessage:
            '{source} couldn’t load, so this page may be missing some.'
    },
    published: {
        id: 'publishing.page.publishedToast',
        defaultMessage:
            '{count, plural, one {# entry published.} other {# entries published.}}'
    },
    publishFailed: {
        id: 'publishing.page.publishFailed',
        defaultMessage: 'Publishing didn’t complete. Please try again.'
    },
    cellName: {
        id: 'publishing.page.cellName',
        defaultMessage: '{record} · {axis}'
    },
    linked: { id: 'publishing.page.linked', defaultMessage: 'Linked drafts' }
});

/**
 * **The Publish Manager** — publish a set of records *together*: the records
 * that were selected, their other translations, and the drafts they link to.
 * Opened with a set in the URL (`?type=…&ids=…`) from the records selection bar
 * or a record's ⋯ menu.
 *
 * Deliberately small. It shows only what is a decision: a line per record with
 * a pill per locale that has something to publish (live locales and missing
 * translations are not decisions, so they are not shown), the drafts those
 * records link to, and — only when there is any — one **Needs attention** list
 * naming what a locale is missing. Content's dry run runs by itself, so a
 * blocked locale is never offered: it appears in that list instead, and comes
 * back as a pill once it is fixed and checked again.
 *
 * It owns no publishing: the dry run and the commit are content's bulk
 * endpoints, per type, linked drafts first. Content describes the set
 * (`bulk/publish/context`); other plugins add translations
 * (`PUBLISH_EXPANSION_SLOT`) and approval notes (`PUBLISH_ANNOTATION_SLOT`).
 */
export function PublishManagerPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const [params] = useSearchParams();
    const set = useMemo(() => parsePublishSet(params), [params]);
    const [version, setVersion] = useState(0);

    const types = useContentTypes(canPublish);
    const typeLabel = (name: string) =>
        types.data?.find((type) => type.name === name)?.label ?? name;

    const context = usePublishContext(workspace.id, set, version, canPublish);
    const view = usePublishRecords(
        set?.ids ?? NO_IDS,
        set?.type ?? '',
        context.data,
        { workspaceId: workspace.id, version }
    );
    // The option set the last automatic check ran over; `null` forces the
    // next one (after a commit, whose outcome may have changed nothing).
    const [checkedKey, setCheckedKey] = useState<string | null>(null);
    const run = usePublishRun(workspace.id, () => {
        setVersion((v) => v + 1);
        setCheckedKey(null);
    });

    // The records as the reader sees them: a cell the last check blocked is
    // not an option. The unmarked records are what the check runs over, so a
    // fixed entry is asked again and comes back.
    const records = useMemo(
        () =>
            withBlocked(
                view.records,
                (id) => run.verdicts.get(id)?.verdict === BULK_VERDICT.Blocked
            ),
        [view.records, run.verdicts]
    );

    // Picks follow the records — everything that can publish starts picked,
    // and `reconcilePicks` carries the reader's choices across every change
    // (a translation arriving, a verdict landing, the re-read after a commit).
    const [picks, setPicks] = useState<Picks>(new Map());
    const [seenRecords, setSeenRecords] = useState<readonly PublishRecord[]>(
        []
    );
    if (seenRecords !== records) {
        setSeenRecords(records);
        setPicks(
            reconcilePicks(picks, seenRecords, records, PICK_PRESET.Everything)
        );
    }

    // The dry run runs by itself over every entry that could publish, once the
    // records have settled, and again whenever that set changes.
    const optionKey = useMemo(
        () => JSON.stringify(optionBatches(view.records)),
        [view.records]
    );
    const settled =
        !!context.data &&
        !context.isFetching &&
        !view.expanding &&
        !run.isCommitting;
    useEffect(() => {
        if (!settled || optionKey === checkedKey) return;
        setCheckedKey(optionKey);
        const batches = optionBatches(view.records);
        if (batches.length) void run.check(batches).catch(() => undefined);
        // `run.check` is a fresh closure each render; the key is the trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settled, optionKey, checkedKey]);

    const working = run.isChecking || run.isCommitting;
    const picked = pickedCells(picks, records);
    const publishCount = picked.filter(
        (cell) =>
            run.verdicts.get(cell.id)?.verdict === BULK_VERDICT.Publishable
    ).length;
    const optionCount = records.reduce(
        (sum, record) => sum + optionAxes(record).length,
        0
    );
    const held = (id: string) =>
        (view.annotations.get(id) ?? []).some((note) => note.blocking);

    // "{record} · {language}" for every entry — the name the attention list,
    // the outcome and the toasts use.
    const names = new Map<string, string>();
    for (const record of records) {
        const title = recordTitle(record);
        for (const cell of record.cells.values()) {
            const axis =
                cell.axis === BASE_AXIS
                    ? ''
                    : (view.axes.get(cell.axis)?.label ?? cell.axis);
            names.set(
                cell.id,
                axis
                    ? intl.formatMessage(messages.cellName, {
                          record: cell.title ?? title,
                          axis
                      })
                    : (cell.title ?? title)
            );
        }
    }
    const attention: AttentionEntry[] = records.flatMap((record) =>
        [...record.cells.values()].flatMap((cell) => {
            if (cell.status === LIVE_STATUS) return [];
            const verdict = cell.blocked
                ? run.verdicts.get(cell.id)
                : undefined;
            const notes = (view.annotations.get(cell.id) ?? []).filter(
                (note) => note.blocking
            );
            return verdict || notes.length
                ? [
                      {
                          entryId: cell.id,
                          type: cell.type,
                          name: names.get(cell.id) ?? cell.id,
                          verdict,
                          notes
                      }
                  ]
                : [];
        })
    );

    const onRecheck = () => {
        void run.check(optionBatches(view.records)).catch(() => undefined);
    };
    const onPublish = () => {
        run.commit(publishBatches(picks, records))
            .then((result) => {
                const count = [...result.outcomes.values()].filter(
                    (outcome) => outcome.kind === 'published'
                ).length;
                toast.success(
                    intl.formatMessage(messages.published, { count })
                );
            })
            .catch(() =>
                toast.error(intl.formatMessage(messages.publishFailed))
            );
    };

    const header = (
        <PageTopBar
            icon={ListChecks}
            crumbs={[
                { key: 'publish', label: intl.formatMessage(messages.title) }
            ]}
        />
    );

    if (!canPublish || !set) {
        return (
            <>
                {header}
                <Container width="full">
                    <ContainerHeader
                        title={intl.formatMessage(messages.title)}
                        subtitle={intl.formatMessage(messages.subtitle)}
                    />
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(
                            canPublish ? messages.noSet : messages.forbidden
                        )}
                    </p>
                </Container>
            </>
        );
    }

    const listProps = {
        typeLabel,
        workspaceId: workspace.id,
        axes: view.axes,
        picks,
        held,
        outcomes: run.result?.outcomes,
        disabled: working,
        onPicks: setPicks
    };

    return (
        <>
            {header}
            <Container width="full">
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />

                {context.isPending ? (
                    <SkeletonRegion
                        label={intl.formatMessage(messages.loading)}
                    >
                        <Skeleton className="mb-4 h-9 w-80" />
                        <Skeleton className="h-48 w-full" />
                    </SkeletonRegion>
                ) : context.isError ? (
                    <div className="flex items-center gap-3">
                        <p role="alert" className="text-sm text-destructive">
                            {intl.formatMessage(messages.failed)}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void context.refetch()}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </div>
                ) : (
                    <div className="flex max-w-4xl flex-col gap-5">
                        <PublishToolbar
                            axes={[...view.axes.values()]}
                            records={records}
                            picks={picks}
                            pickedCount={picked.length}
                            optionCount={optionCount}
                            attentionCount={attention.length}
                            publishCount={publishCount}
                            isChecking={run.isChecking}
                            isCommitting={run.isCommitting}
                            checkFailed={run.checkFailed}
                            busy={view.expanding || context.isFetching}
                            onToggleAxis={(axis, on) =>
                                setPicks((current) =>
                                    setAxis(current, records, axis, on)
                                )
                            }
                            onRecheck={onRecheck}
                            onPublish={onPublish}
                        />

                        {run.result && (
                            <PublishOutcomeSummary
                                result={run.result}
                                nameOf={(id) => names.get(id) ?? id}
                            />
                        )}

                        {view.failed.map((source) => (
                            <div
                                key={source.id}
                                className="flex items-center gap-3"
                            >
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {intl.formatMessage(messages.sourceFailed, {
                                        source: intl.formatMessage(source.label)
                                    })}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={source.retry}
                                >
                                    {intl.formatMessage(messages.retry)}
                                </Button>
                            </div>
                        ))}

                        <PublishRecordList
                            title={typeLabel(set.type)}
                            records={records.filter(
                                (record) => record.selected
                            )}
                            {...listProps}
                        />
                        <PublishRecordList
                            title={intl.formatMessage(messages.linked)}
                            records={records.filter(
                                (record) => !record.selected
                            )}
                            {...listProps}
                        />

                        <AttentionList
                            workspaceId={workspace.id}
                            entries={attention}
                        />

                        {view.missing.length > 0 || view.linkedTruncated ? (
                            <p className="text-xs text-muted-foreground">
                                {view.missing.length > 0
                                    ? intl.formatMessage(messages.missing, {
                                          count: view.missing.length
                                      })
                                    : null}{' '}
                                {view.linkedTruncated
                                    ? intl.formatMessage(messages.truncated)
                                    : null}
                            </p>
                        ) : null}
                    </div>
                )}
            </Container>
        </>
    );
}
