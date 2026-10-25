import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Container,
    ContainerHeader,
    InputField,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner,
    toast
} from '@orthacms/design-system';
import {
    QueryBuilderPopover,
    jsonFilterToTree,
    treeToJsonFilter,
    type FilterGroup
} from '@orthacms/query-builder-admin';
import {
    RelationValuePicker,
    RequiredMark,
    useContentTypes
} from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { PageActionsPortal, PageTopBar } from '@orthacms/shell-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { BellRing, Plus, Table2 } from 'lucide-react';
import { useAlarmRules } from '../../../application/useAlarmRules';
import {
    useCreateAlarmRule,
    usePreviewAlarmRule,
    useUpdateAlarmRule
} from '../../../application/useAlarmRuleMutations';
import { useConditionFields } from '../../../application/useConditionFields';
import { useTypeLabels } from '../../../application/useTypeLabels';
import type { AlarmSeverity } from '../../../types/alarm';
import {
    changedConditionIds,
    flattenConditions,
    removeCondition
} from '../../../utils/conditions';
import { previewVerdict } from '../../../utils/previewVerdict';
import { AlarmPreviewPanel } from '../../components/AlarmPreviewPanel';
import { AlarmsNoAccess } from '../../components/AlarmsNoAccess';
import { AlarmsSkeleton } from '../../components/AlarmsSkeleton';
import { Callout } from '../../components/Callout';
import { ConditionChips } from '../../components/ConditionChips';
import { SeverityPicker } from '../../components/SeverityPicker';
import { scanMessage } from '../../scanMessage';

const messages = defineMessages({
    title: { id: 'alarms.editor.title', defaultMessage: 'Edit alarm' },
    createTitle: {
        id: 'alarms.editor.createTitle',
        defaultMessage: 'New alarm'
    },
    createSubtitle: {
        id: 'alarms.editor.createSubtitle',
        defaultMessage:
            'Pick what to watch, then say what counts as a problem. Nothing is ever blocked — a match is flagged.'
    },
    subtitleCreator: {
        id: 'alarms.editor.subtitleCreator',
        defaultMessage: 'created by {name}'
    },
    subtitleFlagged: {
        id: 'alarms.editor.subtitleFlagged',
        defaultMessage:
            '{count, plural, =0 {nothing flagged now} one {# record flagged now} other {# records flagged now}}'
    },
    crumbNew: { id: 'alarms.editor.crumbNew', defaultMessage: 'New alarm' },
    crumbAlarms: { id: 'alarms.editor.crumbAlarms', defaultMessage: 'Alarms' },
    contentType: {
        id: 'alarms.editor.contentType',
        defaultMessage: 'What to watch'
    },
    contentTypePlaceholder: {
        id: 'alarms.editor.contentTypePlaceholder',
        defaultMessage: 'Choose a collection…'
    },
    pickTypeFirst: {
        id: 'alarms.editor.pickTypeFirst',
        defaultMessage: 'Choose a collection above to set conditions.'
    },
    name: { id: 'alarms.editor.name', defaultMessage: 'Alarm name' },
    findingTitle: {
        id: 'alarms.editor.findingTitle',
        defaultMessage: 'What editors will see'
    },
    findingHint: {
        id: 'alarms.editor.findingHint',
        defaultMessage: 'Shown on the record itself, in its status.'
    },
    severity: { id: 'alarms.editor.severity', defaultMessage: 'Level' },
    condition: {
        id: 'alarms.editor.condition',
        defaultMessage: 'Flag a record when…'
    },
    addCondition: {
        id: 'alarms.editor.addCondition',
        defaultMessage: 'Condition'
    },
    editCondition: {
        id: 'alarms.editor.editCondition',
        defaultMessage: 'Edit conditions'
    },
    noCondition: {
        id: 'alarms.editor.noCondition',
        defaultMessage:
            'No conditions yet. An alarm needs at least one, or it would flag every record.'
    },
    unsaved: {
        id: 'alarms.editor.unsaved',
        defaultMessage:
            'Conditions changed. Nothing is flagged or cleared until you save.'
    },
    brokenTitle: {
        id: 'alarms.editor.brokenTitle',
        defaultMessage: 'This condition no longer matches the content type'
    },
    notFoundTitle: {
        id: 'alarms.editor.notFoundTitle',
        defaultMessage: 'No such alarm'
    },
    notFoundBody: {
        id: 'alarms.editor.notFoundBody',
        defaultMessage: 'It may have been deleted. Go back to the alarms list.'
    },
    create: { id: 'alarms.editor.create', defaultMessage: 'Create alarm' },
    cancel: { id: 'alarms.editor.cancel', defaultMessage: 'Cancel' },
    save: { id: 'alarms.editor.save', defaultMessage: 'Save changes' },
    saved: { id: 'alarms.editor.saved', defaultMessage: 'Alarm saved.' },
    saveFailed: {
        id: 'alarms.editor.saveFailed',
        defaultMessage: 'The alarm could not be saved: {reason}'
    }
});

/** Props for {@link AlarmRuleEditorPage}. */
export type AlarmRuleEditorPageProps = {
    /**
     * `'create'` mounts the same page as a blank form with a collection
     * picker; `'edit'` (the default) loads the rule named by the route.
     *
     * One component for both, because the two forms are the same form: the
     * wording, the level, the conditions and the live preview are identical,
     * and the only genuine difference is whether the collection is chosen or
     * already fixed.
     */
    mode?: 'create' | 'edit';
};

/**
 * Creates or edits one alarm: what it watches, its wording, its level and its
 * conditions — with what it would flag **right now** beside the form.
 *
 * The conditions are edited with the **records list's own query builder**, over
 * the same filterable surface, so an alarm can only ever say something the list
 * can say. They rest as chips ("SEO description *is* empty") with a
 * "+ Condition" button that opens the builder; removing a chip re-commits at
 * once.
 *
 * **The preview is what makes the blank form safe.** It re-runs whenever the
 * committed conditions change and shows the count, a sample of the records by
 * title, and the finding as editors will see it — and when every record
 * matches it says the condition is probably inverted, before anything is
 * saved, and tints the conditions that changed since the last save.
 *
 * **Apply changes the chips; Save re-checks the collection.** The unsaved
 * notice says so in words, and the toast after Save reports what the re-check
 * did ("checked 842, 38 flagged, 2 cleared").
 */
export function AlarmRuleEditorPage({
    mode = 'edit'
}: AlarmRuleEditorPageProps = {}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const workspace = useCurrentWorkspace();
    const { ruleId } = useParams<{ ruleId: string }>();
    const canRead = useHasPermission('alarms:read');
    const canManage = useHasPermission('alarms:manage');
    const isCreate = mode === 'create';
    const levelId = useId();
    const conditionHeadingId = useId();
    const conditionButton = useRef<HTMLButtonElement>(null);

    const rules = useAlarmRules(canRead && !isCreate);
    const rule = useMemo(
        () => rules.data?.find((candidate) => candidate.id === ruleId),
        [rules.data, ruleId]
    );

    // Only meaningful while creating; an existing alarm's type is fixed,
    // because changing it would make every finding it has opened a statement
    // about the wrong collection.
    const [contentType, setContentType] = useState('');
    const [name, setName] = useState('');
    const [findingTitle, setFindingTitle] = useState('');
    const [severity, setSeverity] = useState<AlarmSeverity>('warn');
    const [tree, setTree] = useState<FilterGroup | null>(null);

    // Seed the form once the rule arrives. Keyed on the id alone,
    // deliberately: depending on the rule object would let a background
    // refetch re-seed the form and discard edits in progress.
    useEffect(() => {
        if (!rule) return;
        setName(rule.name);
        setFindingTitle(rule.findingTitle);
        setSeverity(rule.severity);
        // `jsonFilterToTree` takes the wire JSON as a string — the same thing
        // the records list has in `?filter=` — while the rule stores it parsed.
        setTree(jsonFilterToTree(JSON.stringify(rule.filter)));
    }, [rule?.id]);

    const watchedType = isCreate ? contentType : (rule?.contentType ?? '');
    const conditionFields = useConditionFields(watchedType);
    const typeLabel = useTypeLabels(canRead);

    const types = useContentTypes(canRead && isCreate);
    // The catalogue is **global**; an alarm can only watch a collection this
    // workspace owns (the server refuses any other with the same "unknown
    // type" as an unregistered one), so the picker offers exactly those. A
    // shared-only type is left out too: its records live at the source.
    const typeOptions = useMemo(() => {
        const granted = new Set(workspace.content);
        return (types.data ?? []).filter(
            (type) => type.kind === 'collection' && granted.has(type.name)
        );
    }, [types.data, workspace.content]);

    const create = useCreateAlarmRule();
    const update = useUpdateAlarmRule();
    const preview = usePreviewAlarmRule();

    /**
     * The current conditions as the wire tree the API stores.
     *
     * **`relativeDates` is the important argument** (`alarms:I-26`). By
     * default a "within the last N days" rule is serialised as a concrete
     * cutoff — right for a shared link, and silently wrong for a stored rule,
     * which would then mean "since the day I was written" for ever.
     */
    const filterJson = useMemo((): Record<string, unknown> | null => {
        const json = tree
            ? treeToJsonFilter(tree, new Date(), { relativeDates: true })
            : null;
        if (!json) return null;
        try {
            const parsed: unknown = JSON.parse(json);
            return parsed &&
                typeof parsed === 'object' &&
                !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : null;
        } catch {
            return null;
        }
    }, [tree]);

    // A stable identity for "these conditions", so the count re-runs when they
    // actually change and not on every render.
    const filterKey = filterJson ? JSON.stringify(filterJson) : null;

    /**
     * Re-count the matches whenever the committed conditions change.
     *
     * `previewFor` is a ref rather than a dependency so the effect keys on the
     * conditions alone: `preview.mutate` is a new identity on every render, and
     * depending on it would re-run this on each keystroke in the name field —
     * one collection scan per character.
     */
    const previewFor = useRef<{
        contentType?: string;
        run: (input: {
            contentType: string;
            filter: Record<string, unknown>;
        }) => void;
    }>({ run: () => undefined });
    previewFor.current = {
        contentType: watchedType || undefined,
        run: preview.mutate
    };

    useEffect(() => {
        const { contentType, run } = previewFor.current;
        if (!contentType || !filterKey) return;
        run({
            contentType,
            filter: JSON.parse(filterKey) as Record<string, unknown>
        });
    }, [filterKey, watchedType]);

    // The stored conditions as a tree, for telling which chips changed.
    const savedTree = useMemo(
        () => (rule ? jsonFilterToTree(JSON.stringify(rule.filter)) : null),
        [rule?.filter]
    );

    const pageTitle = intl.formatMessage(
        isCreate ? messages.createTitle : messages.title
    );
    const crumbs = [
        {
            key: 'alarms',
            label: intl.formatMessage(messages.crumbAlarms),
            to: `/workspaces/${workspace.id}/alarms`
        },
        {
            key: 'rule',
            label: isCreate
                ? intl.formatMessage(messages.crumbNew)
                : (rule?.name ?? pageTitle)
        }
    ];

    if (!canRead) {
        return (
            <>
                <PageTopBar icon={BellRing} crumbs={crumbs} />
                <Container>
                    <ContainerHeader title={pageTitle} />
                    <AlarmsNoAccess />
                </Container>
            </>
        );
    }

    // Creating needs no rule, so neither guard below applies: the rules query
    // is disabled in that mode and would otherwise report `isPending` for ever.
    if (!isCreate && rules.isPending) return <AlarmsSkeleton />;

    if (!isCreate && !rule) {
        return (
            <>
                <PageTopBar icon={BellRing} crumbs={crumbs} />
                <Container>
                    <ContainerHeader title={pageTitle} />
                    <Alert>
                        <AlertTitle>
                            {intl.formatMessage(messages.notFoundTitle)}
                        </AlertTitle>
                        <AlertDescription>
                            {intl.formatMessage(messages.notFoundBody)}
                        </AlertDescription>
                    </Alert>
                </Container>
            </>
        );
    }

    // `?? ''` rather than a null guard: clearing every condition **is** a
    // change (`alarms:I-28`). The notice below stays quiet in that case,
    // because the empty-state line and a disabled Save already say more.
    const savedFilterKey = rule ? JSON.stringify(rule.filter) : null;
    const conditionsDirty =
        savedFilterKey !== null && (filterKey ?? '') !== savedFilterKey;
    const hasCondition = flattenConditions(tree).length > 0;

    const verdict =
        hasCondition && preview.data && !preview.isPending
            ? previewVerdict(preview.data)
            : null;
    // The likely culprits when the condition looks inverted: whatever differs
    // from what is stored (everything, on a new alarm).
    const suspectIds = verdict?.inverted
        ? changedConditionIds(tree, savedTree)
        : undefined;

    const creator = rule?.createdBy
        ? workspace.members.find((member) => member.id === rule.createdBy)
        : undefined;
    const subtitle = isCreate
        ? intl.formatMessage(messages.createSubtitle)
        : [
              typeLabel(rule?.contentType ?? ''),
              creator
                  ? intl.formatMessage(messages.subtitleCreator, {
                        name: creator.name
                    })
                  : null,
              intl.formatMessage(messages.subtitleFlagged, {
                  count: rule?.openCount ?? 0
              })
          ]
              .filter(Boolean)
              .join(' · ');

    const canSave =
        canManage &&
        !update.isPending &&
        !create.isPending &&
        filterJson !== null &&
        (!isCreate || Boolean(contentType)) &&
        name.trim().length > 0 &&
        findingTitle.trim().length > 0;

    const backToList = () => navigate(`/workspaces/${workspace.id}/alarms`);

    const onFailed = (error: unknown) =>
        toast.error(
            intl.formatMessage(messages.saveFailed, {
                reason: (error as Error).message
            })
        );

    const onSave = () => {
        // Never send `undefined` to mean "leave it alone": with no conditions
        // Save is disabled, so reaching this with a null filter is impossible,
        // and silently keeping the previous condition would be the worst
        // outcome available (`alarms:I-27`, `alarms:I-28`).
        if (!filterJson) return;

        if (isCreate) {
            create.mutate(
                {
                    contentType,
                    name: name.trim(),
                    findingTitle: findingTitle.trim(),
                    severity,
                    filter: filterJson
                },
                {
                    onSuccess: (result) => {
                        // The server scans before it answers, so the toast can
                        // say what the alarm actually found.
                        toast.success(
                            scanMessage(intl, result.rule.name, result.scan)
                        );
                        backToList();
                    },
                    onError: onFailed
                }
            );
            return;
        }

        if (!rule) return;
        update.mutate(
            {
                id: rule.id,
                input: {
                    name: name.trim(),
                    findingTitle: findingTitle.trim(),
                    severity,
                    filter: filterJson
                }
            },
            {
                onSuccess: (result) =>
                    toast.success(
                        result.scan
                            ? scanMessage(intl, result.name, result.scan)
                            : intl.formatMessage(messages.saved)
                    ),
                onError: onFailed
            }
        );
    };

    const saveLabel = intl.formatMessage(
        isCreate ? messages.create : messages.save
    );
    const saveBusy = update.isPending || create.isPending;

    return (
        <>
            <PageTopBar icon={BellRing} crumbs={crumbs} />
            {/* Editing saves from the top bar, where every other section's
                page action sits; creating ends the form with its own pair. */}
            {!isCreate && canManage ? (
                <PageActionsPortal>
                    <Button size="sm" disabled={!canSave} onClick={onSave}>
                        {saveBusy ? <Spinner /> : null}
                        {saveLabel}
                    </Button>
                </PageActionsPortal>
            ) : null}
            <Container className="flex max-w-[940px] flex-col gap-5">
                <ContainerHeader
                    className="mb-0"
                    title={pageTitle}
                    subtitle={subtitle}
                />

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="alarms-editor-type">
                                {intl.formatMessage(messages.contentType)}
                                <RequiredMark />
                            </Label>
                            {/* Disabled while editing: every finding an alarm
                                holds is a statement about a record of its
                                type, so changing it would not edit the alarm,
                                it would silently repurpose its history. */}
                            <Select
                                value={watchedType}
                                disabled={!canManage || !isCreate}
                                onValueChange={(next) => {
                                    setContentType(next);
                                    // The conditions belong to the old type's
                                    // fields; keeping them would offer a
                                    // builder full of rules the new type
                                    // cannot resolve.
                                    setTree(null);
                                }}
                            >
                                <SelectTrigger
                                    id="alarms-editor-type"
                                    aria-required
                                >
                                    {/* `!flex`: the trigger clamps its direct
                                        `<span>` children to one line with
                                        `display: -webkit-box`, which would
                                        stack the icon over the text. */}
                                    <span className="!flex min-w-0 items-center gap-2">
                                        <Table2
                                            aria-hidden="true"
                                            className="size-4 shrink-0 text-muted-foreground"
                                        />
                                        <SelectValue
                                            placeholder={intl.formatMessage(
                                                messages.contentTypePlaceholder
                                            )}
                                        />
                                    </span>
                                </SelectTrigger>
                                <SelectContent>
                                    {isCreate ? (
                                        typeOptions.map((type) => (
                                            <SelectItem
                                                key={type.name}
                                                value={type.name}
                                            >
                                                {type.label}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value={watchedType}>
                                            {typeLabel(watchedType)}
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* `label` is wrapped in **one** element: `FieldLabel`
                            is a flex row with a gap, so two items would put 8px
                            between the word and its `*`. */}
                        <InputField
                            id="alarms-editor-name"
                            label={
                                <span>
                                    {intl.formatMessage(messages.name)}
                                    <RequiredMark />
                                </span>
                            }
                            aria-required
                            value={name}
                            disabled={!canManage}
                            onChange={(event) => setName(event.target.value)}
                        />
                        <InputField
                            id="alarms-editor-finding-title"
                            label={
                                <span>
                                    {intl.formatMessage(messages.findingTitle)}
                                    <RequiredMark />
                                </span>
                            }
                            aria-required
                            description={intl.formatMessage(
                                messages.findingHint
                            )}
                            value={findingTitle}
                            disabled={!canManage}
                            onChange={(event) =>
                                setFindingTitle(event.target.value)
                            }
                        />

                        <div className="flex flex-col gap-1.5">
                            <span
                                id={levelId}
                                className="text-sm font-medium leading-none"
                            >
                                {intl.formatMessage(messages.severity)}
                            </span>
                            <SeverityPicker
                                labelledBy={levelId}
                                value={severity}
                                onChange={setSeverity}
                                disabled={!canManage}
                            />
                        </div>

                        <section
                            aria-labelledby={conditionHeadingId}
                            className="flex flex-col gap-2"
                        >
                            {/* A heading, not a bare label: the conditions are
                                what the alarm *is*, and the fields above are
                                how it is worded. Drawn at the label's size. */}
                            <h2
                                id={conditionHeadingId}
                                className="text-sm font-medium leading-none"
                            >
                                {intl.formatMessage(messages.condition)}
                            </h2>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <ConditionChips
                                    tree={tree}
                                    fields={conditionFields.fields}
                                    suspectIds={suspectIds}
                                    onRemove={
                                        canManage && tree
                                            ? (id) =>
                                                  setTree(
                                                      removeCondition(tree, id)
                                                  )
                                            : undefined
                                    }
                                    onEmptied={() =>
                                        conditionButton.current?.focus()
                                    }
                                />
                                {/* The builder opens in a popover anchored to
                                    this button; Apply commits into the chips
                                    beside it and closes it. The load state is
                                    threaded through: a builder handed an empty
                                    surface while it loads refuses every rule
                                    and says nothing about why. */}
                                <QueryBuilderPopover
                                    title={intl.formatMessage(
                                        messages.editCondition
                                    )}
                                    trigger={
                                        <Button
                                            ref={conditionButton}
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 shrink-0 text-muted-foreground"
                                            disabled={
                                                !canManage || !watchedType
                                            }
                                            aria-label={intl.formatMessage(
                                                messages.editCondition
                                            )}
                                        >
                                            <Plus aria-hidden="true" />
                                            {intl.formatMessage(
                                                messages.addCondition
                                            )}
                                        </Button>
                                    }
                                    fields={conditionFields.fields}
                                    fieldsPending={conditionFields.isPending}
                                    fieldsError={conditionFields.isError}
                                    onRetryFields={conditionFields.refetch}
                                    value={tree}
                                    onApply={setTree}
                                    // The query builder holds no data layer, so
                                    // the record picker for a relation value is
                                    // injected by whoever mounts it.
                                    renderRelationValue={(props) => (
                                        <RelationValuePicker {...props} />
                                    )}
                                />
                            </div>
                            {!watchedType ? (
                                <p className="text-xs text-muted-foreground">
                                    {intl.formatMessage(messages.pickTypeFirst)}
                                </p>
                            ) : !hasCondition ? (
                                <p className="text-xs text-muted-foreground">
                                    {intl.formatMessage(messages.noCondition)}
                                </p>
                            ) : null}
                        </section>

                        {rule?.brokenReason ? (
                            <Callout tone="bad">
                                <b className="font-semibold">
                                    {intl.formatMessage(messages.brokenTitle)}
                                </b>{' '}
                                ({rule.brokenReason})
                            </Callout>
                        ) : null}

                        {conditionsDirty && filterJson ? (
                            <Callout tone="warn">
                                {intl.formatMessage(messages.unsaved)}
                            </Callout>
                        ) : null}
                    </div>

                    <AlarmPreviewPanel
                        typeLabel={watchedType ? typeLabel(watchedType) : ''}
                        hasType={Boolean(watchedType)}
                        hasCondition={hasCondition}
                        preview={preview}
                        findingTitle={findingTitle}
                        name={name}
                        severity={severity}
                    />
                </div>

                {isCreate && canManage ? (
                    <div className="flex items-center gap-2">
                        <Button disabled={!canSave} onClick={onSave}>
                            {saveBusy ? <Spinner /> : null}
                            {saveLabel}
                        </Button>
                        <Button variant="ghost" onClick={backToList}>
                            {intl.formatMessage(messages.cancel)}
                        </Button>
                    </div>
                ) : null}
            </Container>
        </>
    );
}
