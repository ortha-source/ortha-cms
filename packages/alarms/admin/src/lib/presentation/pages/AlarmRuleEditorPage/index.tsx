import { useEffect, useMemo, useState } from 'react';
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
    Textarea,
    toast
} from '@orthacms/design-system';
import {
    QueryBuilderPanel,
    jsonFilterToTree,
    treeToJsonFilter,
    type FilterGroup
} from '@orthacms/query-builder-admin';
import { useFilterFields } from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { TriangleAlert } from 'lucide-react';
import { useAlarmRules } from '../../../application/useAlarmRules';
import {
    usePreviewAlarmRule,
    useUpdateAlarmRule
} from '../../../application/useAlarmRuleMutations';
import { ALARM_SEVERITIES, type AlarmSeverity } from '../../../types/alarm';
import { AlarmsNoAccess } from '../../components/AlarmsNoAccess';
import { AlarmsSkeleton } from '../../components/AlarmsSkeleton';

const messages = defineMessages({
    title: { id: 'alarms.editor.title', defaultMessage: 'Edit rule' },
    subtitle: {
        id: 'alarms.editor.subtitle',
        defaultMessage:
            'Watching {contentType}. Changing the condition re-checks the whole collection.'
    },
    notFoundTitle: {
        id: 'alarms.editor.notFoundTitle',
        defaultMessage: 'No such rule'
    },
    notFoundBody: {
        id: 'alarms.editor.notFoundBody',
        defaultMessage: 'It may have been deleted. Go back to the alarms list.'
    },
    back: { id: 'alarms.editor.back', defaultMessage: 'Back to alarms' },
    name: { id: 'alarms.editor.name', defaultMessage: 'Rule name' },
    findingTitle: {
        id: 'alarms.editor.findingTitle',
        defaultMessage: 'What editors will see'
    },
    findingHint: {
        id: 'alarms.editor.findingHint',
        defaultMessage:
            'Shown on the record itself: “Author is not published”.'
    },
    description: {
        id: 'alarms.editor.description',
        defaultMessage: 'Notes (optional)'
    },
    severity: { id: 'alarms.editor.severity', defaultMessage: 'Level' },
    severityError: {
        id: 'alarms.editor.severityError',
        defaultMessage: 'Error'
    },
    severityWarn: {
        id: 'alarms.editor.severityWarn',
        defaultMessage: 'Warning'
    },
    severityInfo: { id: 'alarms.editor.severityInfo', defaultMessage: 'Info' },
    condition: { id: 'alarms.editor.condition', defaultMessage: 'Condition' },
    editCondition: {
        id: 'alarms.editor.editCondition',
        defaultMessage: 'Edit condition'
    },
    noCondition: {
        id: 'alarms.editor.noCondition',
        defaultMessage: 'No condition — this rule would match every record.'
    },
    matches: {
        id: 'alarms.editor.matches',
        defaultMessage: 'Matches now: {matched} of {total}'
    },
    checkMatches: {
        id: 'alarms.editor.checkMatches',
        defaultMessage: 'Count matches'
    },
    brokenTitle: {
        id: 'alarms.editor.brokenTitle',
        defaultMessage: 'This condition no longer matches the content type'
    },
    save: { id: 'alarms.editor.save', defaultMessage: 'Save changes' },
    saved: { id: 'alarms.editor.saved', defaultMessage: 'Rule saved.' },
    saveFailed: {
        id: 'alarms.editor.saveFailed',
        defaultMessage: 'The rule could not be saved: {reason}'
    }
});

/** The severity labels, keyed the same way the type is. */
const SEVERITY_LABELS = {
    error: messages.severityError,
    warn: messages.severityWarn,
    info: messages.severityInfo
} as const;

/**
 * Edits one rule: its wording, its level, and its condition.
 *
 * The condition is edited with the **records list's own query builder**, over
 * the same `/content-schema/:name/filter-fields` surface — so a rule can only
 * ever say something the list can say, and there is no second grammar to learn,
 * document or keep in step with the engine.
 *
 * There is deliberately no "create rule" counterpart. A rule is created from a
 * filter someone already built and already looked at, via "Save as rule" in the
 * records toolbar; a blank condition form invites writing a rule against a
 * collection you have not looked at, which is how you get a rule that matches
 * everything.
 */
export function AlarmRuleEditorPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const workspace = useCurrentWorkspace();
    const { ruleId } = useParams<{ ruleId: string }>();
    const canRead = useHasPermission('alarms:read');
    const canManage = useHasPermission('alarms:manage');

    const rules = useAlarmRules(canRead);
    const rule = useMemo(
        () => rules.data?.find((candidate) => candidate.id === ruleId),
        [rules.data, ruleId]
    );

    const [name, setName] = useState('');
    const [findingTitle, setFindingTitle] = useState('');
    const [description, setDescription] = useState('');
    const [severity, setSeverity] = useState<AlarmSeverity>('warn');
    const [tree, setTree] = useState<FilterGroup | null>(null);
    const [builderOpen, setBuilderOpen] = useState(false);

    // Seed the form once the rule arrives. Keyed on the id, not the object, so
    // a background refetch cannot discard edits in progress by re-seeding from
    // the server's copy.
    useEffect(() => {
        if (!rule) return;
        setName(rule.name);
        setFindingTitle(rule.findingTitle);
        setDescription(rule.description ?? '');
        setSeverity(rule.severity);
        // `jsonFilterToTree` takes the wire JSON as a string — the same
        // thing the records list has in `?filter=` — while the rule stores
        // it parsed. One `stringify` beats a second parser.
        setTree(jsonFilterToTree(JSON.stringify(rule.filter)));
        // Keyed on the id alone, deliberately: depending on the rule object
        // would let a background refetch re-seed the form and discard edits in
        // progress.
    }, [rule?.id]);

    const filterFields = useFilterFields(rule?.contentType);
    const update = useUpdateAlarmRule();
    const preview = usePreviewAlarmRule();

    if (!canRead) {
        return (
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                />
                <AlarmsNoAccess />
            </Container>
        );
    }

    if (rules.isPending) return <AlarmsSkeleton />;

    if (!rule) {
        return (
            <Container>
                <ContainerHeader title={intl.formatMessage(messages.title)} />
                <Alert>
                    <TriangleAlert aria-hidden="true" />
                    <AlertTitle>
                        {intl.formatMessage(messages.notFoundTitle)}
                    </AlertTitle>
                    <AlertDescription>
                        {intl.formatMessage(messages.notFoundBody)}
                    </AlertDescription>
                </Alert>
                <Button
                    variant="outline"
                    className="self-start"
                    onClick={() =>
                        navigate(`/workspaces/${workspace.id}/alarms`)
                    }
                >
                    {intl.formatMessage(messages.back)}
                </Button>
            </Container>
        );
    }

    /**
     * The current condition as the wire tree the API stores.
     *
     * `treeToJsonFilter` produces the JSON string the records list puts in its
     * URL; the rules API takes the same tree as an object, so it is parsed back
     * rather than re-serialised by a second implementation.
     *
     * **`relativeDates` is the important argument.** By default a "within the
     * last N days" rule is serialised as a concrete cutoff — right for a shared
     * link, and silently wrong for a stored rule, which would then mean "since
     * the day I was written" for ever. This is the one place in the admin where
     * a filter is stored rather than linked, so it is the one place that asks
     * for the relative spelling.
     */
    const filterJson = ((): Record<string, unknown> | null => {
        const json = tree
            ? treeToJsonFilter(tree, new Date(), { relativeDates: true })
            : null;
        if (!json) return null;
        try {
            const parsed: unknown = JSON.parse(json);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : null;
        } catch {
            return null;
        }
    })();

    const onSave = () => {
        update.mutate(
            {
                id: rule.id,
                input: {
                    name: name.trim(),
                    findingTitle: findingTitle.trim(),
                    description: description.trim(),
                    severity,
                    // Only send the filter when there is one: `undefined` leaves
                    // the stored condition alone, while sending `{}` would
                    // replace it with "matches everything".
                    ...(filterJson ? { filter: filterJson } : {})
                }
            },
            {
                onSuccess: () => {
                    toast.success(intl.formatMessage(messages.saved));
                    navigate(`/workspaces/${workspace.id}/alarms`);
                },
                onError: (error) =>
                    toast.error(
                        intl.formatMessage(messages.saveFailed, {
                            reason: (error as Error).message
                        })
                    )
            }
        );
    };

    return (
        <Container>
            <ContainerHeader
                title={intl.formatMessage(messages.title)}
                subtitle={intl.formatMessage(messages.subtitle, {
                    contentType: rule.contentType
                })}
            />

            {rule.brokenReason ? (
                <Alert variant="destructive">
                    <TriangleAlert aria-hidden="true" />
                    <AlertTitle>
                        {intl.formatMessage(messages.brokenTitle)}
                    </AlertTitle>
                    <AlertDescription>{rule.brokenReason}</AlertDescription>
                </Alert>
            ) : null}

            <div className="flex max-w-2xl flex-col gap-4">
                <InputField
                    id="alarms-editor-name"
                    label={intl.formatMessage(messages.name)}
                    value={name}
                    disabled={!canManage}
                    onChange={(event) => setName(event.target.value)}
                />
                <InputField
                    id="alarms-editor-finding-title"
                    label={intl.formatMessage(messages.findingTitle)}
                    description={intl.formatMessage(messages.findingHint)}
                    value={findingTitle}
                    disabled={!canManage}
                    onChange={(event) => setFindingTitle(event.target.value)}
                />

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="alarms-editor-description">
                        {intl.formatMessage(messages.description)}
                    </Label>
                    <Textarea
                        id="alarms-editor-description"
                        value={description}
                        disabled={!canManage}
                        onChange={(event) => setDescription(event.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="alarms-editor-severity">
                        {intl.formatMessage(messages.severity)}
                    </Label>
                    <Select
                        value={severity}
                        disabled={!canManage}
                        onValueChange={(next) =>
                            setSeverity(next as AlarmSeverity)
                        }
                    >
                        <SelectTrigger id="alarms-editor-severity">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ALARM_SEVERITIES.map((value) => (
                                <SelectItem key={value} value={value}>
                                    {intl.formatMessage(
                                        SEVERITY_LABELS[value]
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">
                        {intl.formatMessage(messages.condition)}
                    </span>
                    <Button
                        id="alarms-editor-condition-toggle"
                        variant="outline"
                        className="self-start"
                        disabled={!canManage}
                        onClick={() => setBuilderOpen((open) => !open)}
                    >
                        {intl.formatMessage(messages.editCondition)}
                    </Button>
                    <QueryBuilderPanel
                        open={builderOpen}
                        onOpenChange={setBuilderOpen}
                        fields={filterFields.fields}
                        value={tree}
                        onApply={setTree}
                        labelledBy="alarms-editor-condition-toggle"
                    />
                    {filterJson ? null : (
                        <p className="text-sm text-muted-foreground">
                            {intl.formatMessage(messages.noCondition)}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        variant="outline"
                        disabled={!filterJson || preview.isPending}
                        onClick={() =>
                            filterJson &&
                            preview.mutate({
                                contentType: rule.contentType,
                                filter: filterJson
                            })
                        }
                    >
                        {preview.isPending ? <Spinner /> : null}
                        {intl.formatMessage(messages.checkMatches)}
                    </Button>
                    <span
                        className="text-sm text-muted-foreground"
                        aria-live="polite"
                    >
                        {preview.data
                            ? intl.formatMessage(messages.matches, {
                                  matched: preview.data.matched,
                                  total: preview.data.total
                              })
                            : null}
                    </span>
                </div>

                {canManage ? (
                    <div className="flex items-center gap-2">
                        <Button
                            disabled={
                                update.isPending ||
                                name.trim().length === 0 ||
                                findingTitle.trim().length === 0
                            }
                            onClick={onSave}
                        >
                            {update.isPending ? <Spinner /> : null}
                            {intl.formatMessage(messages.save)}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() =>
                                navigate(`/workspaces/${workspace.id}/alarms`)
                            }
                        >
                            {intl.formatMessage(messages.back)}
                        </Button>
                    </div>
                ) : null}
            </div>
        </Container>
    );
}
