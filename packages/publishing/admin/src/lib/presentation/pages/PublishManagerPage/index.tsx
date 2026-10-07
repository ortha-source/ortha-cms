import { useMemo, useState } from 'react';
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
    PICK_PRESET,
    pickedCells,
    presetPicks,
    publishBatches,
    reconcilePicks,
    type PickPreset,
    type Picks
} from '../../../domain/publishPicks';
import {
    BASE_AXIS,
    recordTitle,
    type PublishRecord
} from '../../../domain/types';
import { usePublishContext } from '../../../application/usePublishContext';
import { usePublishRun } from '../../../application/usePublishRun';
import { usePublishRecords } from '../../hooks/usePublishRecords';
import { PublishActionBar } from '../../components/PublishActionBar';
import { PublishSectionTable } from '../../components/PublishSectionTable';
import {
    PublishProblems,
    type PublishProblem
} from '../../components/PublishProblems';
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
    }
});

/**
 * **The Publish Manager** — one page for publishing a set of records *together*:
 * the records that were selected, their other translations, and the drafts
 * they link to. Opened with a set in the URL (`?type=…&ids=…`, see
 * `domain/publishSet`) from the records selection bar or a record's ⋯ menu.
 *
 * It owns no publishing of its own. What can go out is decided by content's
 * dry run, per type, and what does go out by content's bulk publish, per type —
 * so every validation rule, publish guard and partial-success answer is the
 * same as everywhere else. What this page adds is the **set**: content
 * describes the entries and their linked drafts (`bulk/publish/context`), other
 * plugins add cells (`PUBLISH_EXPANSION_SLOT` — translations) and notes
 * (`PUBLISH_ANNOTATION_SLOT` — approvals), and the reader picks.
 *
 * The flow is **pick → check → publish**. Publish is offered only after a
 * check, and any change to the picks returns to "check", so what is committed
 * is what was just checked.
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
        {
            workspaceId: workspace.id,
            version
        }
    );
    const run = usePublishRun(workspace.id, () => setVersion((v) => v + 1));

    // Picks follow the records: seeded from the preset when records first
    // appear, carried across every later change (an expansion landing, the
    // re-read after a commit) by `reconcilePicks` — adjusted during render, the
    // React idiom for state derived from a changing input.
    const [preset, setPreset] = useState<PickPreset>(PICK_PRESET.Everything);
    const [picks, setPicksState] = useState<Picks>(new Map());
    const [seenRecords, setSeenRecords] = useState<readonly PublishRecord[]>(
        []
    );
    if (seenRecords !== view.records) {
        setSeenRecords(view.records);
        setPicksState(reconcilePicks(picks, seenRecords, view.records, preset));
    }

    const working = run.isChecking || run.isCommitting;
    // Any change to the picks invalidates the last check.
    const updatePicks = (update: (current: Picks) => Picks) => {
        setPicksState(update);
        run.resetCheck();
    };
    const applyPreset = (next: PickPreset) => {
        setPreset(next);
        updatePicks(() => presetPicks(view.records, next));
    };

    const picked = pickedCells(picks, view.records);
    const batches = publishBatches(picks, view.records);
    const checked = run.verdicts.size > 0;
    const ready = picked.filter(
        (cell) =>
            run.verdicts.get(cell.id)?.verdict === BULK_VERDICT.Publishable
    ).length;

    // "{record} · {axis}" for every cell — the name a problem, a toast or the
    // outcome uses for an entry.
    const axisName = (key: string) =>
        key === BASE_AXIS ? '' : (view.axes.get(key)?.label ?? key);
    const names = new Map<string, { name: string; type: string }>();
    for (const record of view.records) {
        const title = recordTitle(record);
        for (const cell of record.cells.values()) {
            const axis = axisName(cell.axis);
            names.set(cell.id, {
                type: record.type,
                name: axis
                    ? intl.formatMessage(messages.cellName, {
                          record: cell.title ?? title,
                          axis
                      })
                    : (cell.title ?? title)
            });
        }
    }
    const problems: PublishProblem[] = picked.flatMap((cell) => {
        const verdict = run.verdicts.get(cell.id);
        return verdict?.verdict === BULK_VERDICT.Blocked
            ? [
                  {
                      verdict,
                      type: cell.type,
                      name: names.get(cell.id)?.name ?? cell.id
                  }
              ]
            : [];
    });

    const onCheck = () => {
        void run.check(batches).catch(() => undefined);
    };
    const onPublish = () => {
        run.commit(batches)
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
                    <div className="flex flex-col gap-6">
                        <PublishActionBar
                            pickedCount={picked.length}
                            readyCount={ready}
                            checked={checked}
                            isChecking={run.isChecking}
                            isCommitting={run.isCommitting}
                            checkFailed={run.checkFailed}
                            busy={view.expanding || context.isFetching}
                            onPreset={applyPreset}
                            onCheck={onCheck}
                            onPublish={onPublish}
                        />

                        {run.result && (
                            <PublishOutcomeSummary
                                result={run.result}
                                nameOf={(id) => names.get(id)?.name ?? id}
                            />
                        )}

                        {view.missing.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                                {intl.formatMessage(messages.missing, {
                                    count: view.missing.length
                                })}
                            </p>
                        )}
                        {view.linkedTruncated && (
                            <p className="text-sm text-muted-foreground">
                                {intl.formatMessage(messages.truncated)}
                            </p>
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

                        <PublishProblems
                            workspaceId={workspace.id}
                            problems={problems}
                        />

                        {view.sections.map((section) => (
                            <PublishSectionTable
                                key={section.type}
                                section={section}
                                typeLabel={typeLabel(section.type)}
                                workspaceId={workspace.id}
                                definedAxes={view.axes}
                                picks={picks}
                                annotations={view.annotations}
                                verdicts={run.verdicts}
                                outcomes={run.result?.outcomes}
                                disabled={working}
                                onPicks={updatePicks}
                            />
                        ))}
                    </div>
                )}
            </Container>
        </>
    );
}
