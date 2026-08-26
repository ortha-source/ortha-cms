import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { slugify } from '@orthacms/utils-admin';
import { MAX_CONDITION_GROUPS } from '@orthacms/segments-domain';
import {
    Button,
    DateTimePicker,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Field,
    FieldDescription,
    FieldLabel,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Spinner
} from '@orthacms/design-system';
import type {
    AccessFallback,
    AccessRule,
    ConditionGroup
} from '../../../domain/types/accessRule';
import type { SegmentType } from '../../../domain/types/segmentType';
import { ConditionGroupCard } from './ConditionGroupCard';
import { ConditionRow } from './ConditionRow';

const messages = defineMessages({
    createTitle: {
        id: 'segments.ruleEditor.createTitle',
        defaultMessage: 'New access rule'
    },
    editTitle: {
        id: 'segments.ruleEditor.editTitle',
        defaultMessage: 'Edit “{name}”'
    },
    body: {
        id: 'segments.ruleEditor.body',
        defaultMessage:
            'A reusable answer to “who may read this”. Assign it to a workspace, a collection or a single entry — editing it here changes every place it is assigned.'
    },
    readOnlyBody: {
        id: 'segments.ruleEditor.readOnlyBody',
        defaultMessage:
            'This rule is declared above this workspace. You can apply it here, but editing it would change every other workspace using it.'
    },
    label: { id: 'segments.ruleEditor.label', defaultMessage: 'Name' },
    key: { id: 'segments.ruleEditor.key', defaultMessage: 'Key' },
    keyHint: {
        id: 'segments.ruleEditor.keyHint',
        defaultMessage: 'Url-safe, unique in this workspace. Permanent.'
    },
    groups: { id: 'segments.ruleEditor.groups', defaultMessage: 'Who gets in' },
    groupsHint: {
        id: 'segments.ruleEditor.groupsHint',
        defaultMessage:
            'Groups are combined with OR — a reader satisfying any one of them is in. Inside a group, every segment type must hold.'
    },
    addGroup: {
        id: 'segments.ruleEditor.addGroup',
        defaultMessage: 'Add an alternative'
    },
    groupsFull: {
        id: 'segments.ruleEditor.groupsFull',
        defaultMessage:
            'A rule holds at most {max} alternatives. Past that, nobody can read what it does — split it into two rules on different collections instead.'
    },
    or: { id: 'segments.ruleEditor.or', defaultMessage: 'or' },
    exclusions: {
        id: 'segments.ruleEditor.exclusions',
        defaultMessage: 'Never, whatever the groups say'
    },
    exclusionsHint: {
        id: 'segments.ruleEditor.exclusionsHint',
        defaultMessage:
            'Checked first, and it wins over everything above. This is where “everyone except these three” lives — pick “All except” on the axis it applies to.'
    },
    window: {
        id: 'segments.ruleEditor.window',
        defaultMessage: 'Visible from'
    },
    windowUntil: {
        id: 'segments.ruleEditor.windowUntil',
        defaultMessage: 'until'
    },
    windowHint: {
        id: 'segments.ruleEditor.windowHint',
        defaultMessage:
            'Optional. Outside the window nobody gets in, whatever their segments.'
    },
    fallback: {
        id: 'segments.ruleEditor.fallback',
        defaultMessage: 'What a refused reader gets'
    },
    fallbackHidden: {
        id: 'segments.ruleEditor.fallbackHidden',
        defaultMessage: 'Nothing — as if it did not exist'
    },
    fallbackTeaser: {
        id: 'segments.ruleEditor.fallbackTeaser',
        defaultMessage: 'A teaser, naming what is missing'
    },
    fallbackPaywall: {
        id: 'segments.ruleEditor.fallbackPaywall',
        defaultMessage: 'A paywall prompt'
    },
    submitCreate: {
        id: 'segments.ruleEditor.submitCreate',
        defaultMessage: 'Create rule'
    },
    submitEdit: {
        id: 'segments.ruleEditor.submitEdit',
        defaultMessage: 'Save'
    },
    close: { id: 'segments.ruleEditor.close', defaultMessage: 'Close' },
    cancel: { id: 'segments.ruleEditor.cancel', defaultMessage: 'Cancel' },
    pickDate: {
        id: 'segments.ruleEditor.pickDate',
        defaultMessage: 'No bound'
    }
});

/** What the editor submits. */
export type RuleDraft = {
    key: string;
    label: string;
    groups: ConditionGroup[];
    exclusions: Record<string, string[]>;
    startsAt?: string;
    endsAt?: string;
    fallback: AccessFallback;
};

/** Props for {@link RuleEditorDialog}. */
type RuleEditorDialogProps = {
    /** Whether the dialog is shown. */
    open: boolean;
    /** Opens/closes it. */
    onOpenChange: (open: boolean) => void;
    /** The rule being edited, or `null` to create one. */
    editing: AccessRule | null;
    /** Every active segment type — the axes a condition can name. */
    types: readonly SegmentType[];
    /** Whether the caller may write this rule (false for a global one). */
    editable: boolean;
    /** Submits the draft. */
    onSubmit: (draft: RuleDraft) => void;
    /** Whether the write is in flight. */
    submitting: boolean;
};

/** A fresh group: every axis open. */
function emptyGroup(): ConditionGroup {
    return { conditions: {} };
}

/**
 * The rule builder.
 *
 * The shape on screen **is** the shape of the model, deliberately: OR-ed groups
 * of AND-ed per-type conditions, with one absolute exclusion list and a window.
 * That is disjunctive normal form, and the reason it is not a general boolean
 * expression editor is the explain panel — an arbitrary tree has to be explained
 * as a proof, and nobody reads a proof to find out why their article is hidden.
 * The eight-group ceiling is the same argument with a number on it.
 *
 * The exclusions block sits **below** the groups even though it is checked
 * first, because that is the order it is written in: an administrator builds
 * who gets in, then carves out who never does. The copy carries the precedence
 * so the layout does not have to.
 */
export function RuleEditorDialog({
    open,
    onOpenChange,
    editing,
    types,
    editable,
    onSubmit,
    submitting
}: RuleEditorDialogProps) {
    const intl = useIntl();
    const [content, setContent] = useState<HTMLElement | null>(null);
    const [label, setLabel] = useState('');
    const [key, setKey] = useState('');
    const [keyTouched, setKeyTouched] = useState(false);
    const [groups, setGroups] = useState<ConditionGroup[]>([emptyGroup()]);
    const [exclusions, setExclusions] = useState<Record<string, string[]>>({});
    const [startsAt, setStartsAt] = useState<Date | undefined>();
    const [endsAt, setEndsAt] = useState<Date | undefined>();
    const [fallback, setFallback] = useState<AccessFallback>('teaser');

    useEffect(() => {
        if (!open) return;
        setLabel(editing?.label ?? '');
        setKey(editing?.key ?? '');
        setKeyTouched(false);
        setGroups(
            editing?.groups.length
                ? editing.groups.map(cloneGroup)
                : [emptyGroup()]
        );
        setExclusions(
            editing ? structuredCloneExclusions(editing.exclusions) : {}
        );
        setStartsAt(editing?.startsAt ?? undefined);
        setEndsAt(editing?.endsAt ?? undefined);
        setFallback(editing?.fallback ?? 'teaser');
    }, [open, editing]);

    const derivedKey = keyTouched ? key : slugify(label);
    const valid = label.trim().length > 0 && (editing || derivedKey.length > 0);
    const disabled = !editable || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                ref={setContent}
                className="max-h-[90vh] max-w-3xl overflow-y-auto"
            >
                <DialogHeader>
                    <DialogTitle>
                        {editing
                            ? intl.formatMessage(messages.editTitle, {
                                  name: editing.label
                              })
                            : intl.formatMessage(messages.createTitle)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(
                            editable ? messages.body : messages.readOnlyBody
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="rule-form"
                    className="flex flex-col gap-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!valid || disabled) return;
                        onSubmit({
                            key: derivedKey,
                            label: label.trim(),
                            groups,
                            exclusions,
                            ...(startsAt
                                ? { startsAt: startsAt.toISOString() }
                                : {}),
                            ...(endsAt ? { endsAt: endsAt.toISOString() } : {}),
                            fallback
                        });
                    }}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                            <FieldLabel htmlFor="rule-label">
                                {intl.formatMessage(messages.label)}
                            </FieldLabel>
                            <Input
                                id="rule-label"
                                value={label}
                                autoFocus
                                disabled={disabled}
                                onChange={(event) =>
                                    setLabel(event.target.value)
                                }
                            />
                        </Field>
                        {editing ? null : (
                            <Field>
                                <FieldLabel htmlFor="rule-key">
                                    {intl.formatMessage(messages.key)}
                                </FieldLabel>
                                <Input
                                    id="rule-key"
                                    value={derivedKey}
                                    disabled={disabled}
                                    onChange={(event) => {
                                        setKeyTouched(true);
                                        setKey(event.target.value);
                                    }}
                                />
                                <FieldDescription>
                                    {intl.formatMessage(messages.keyHint)}
                                </FieldDescription>
                            </Field>
                        )}
                    </div>

                    <Separator />

                    <section className="flex flex-col gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">
                                {intl.formatMessage(messages.groups)}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {intl.formatMessage(messages.groupsHint)}
                            </p>
                        </div>

                        {groups.map((group, index) => (
                            <div key={index} className="flex flex-col gap-3">
                                {index > 0 ? (
                                    <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        <Separator className="flex-1" />
                                        {intl.formatMessage(messages.or)}
                                        <Separator className="flex-1" />
                                    </div>
                                ) : null}
                                <ConditionGroupCard
                                    index={index + 1}
                                    group={group}
                                    types={types}
                                    disabled={disabled}
                                    container={content}
                                    onChange={(next) =>
                                        setGroups((current) =>
                                            current.map((item, position) =>
                                                position === index ? next : item
                                            )
                                        )
                                    }
                                    onRemove={
                                        groups.length > 1
                                            ? () =>
                                                  setGroups((current) =>
                                                      current.filter(
                                                          (_, position) =>
                                                              position !== index
                                                      )
                                                  )
                                            : undefined
                                    }
                                />
                            </div>
                        ))}

                        {groups.length >= MAX_CONDITION_GROUPS ? (
                            <p className="text-xs text-muted-foreground">
                                {intl.formatMessage(messages.groupsFull, {
                                    max: MAX_CONDITION_GROUPS
                                })}
                            </p>
                        ) : (
                            <div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={disabled}
                                    onClick={() =>
                                        setGroups((current) => [
                                            ...current,
                                            emptyGroup()
                                        ])
                                    }
                                >
                                    <Plus aria-hidden />
                                    {intl.formatMessage(messages.addGroup)}
                                </Button>
                            </div>
                        )}
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">
                                {intl.formatMessage(messages.exclusions)}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {intl.formatMessage(messages.exclusionsHint)}
                            </p>
                        </div>
                        {types.map((type) => (
                            <ConditionRow
                                key={type.id}
                                type={type}
                                // The exclusion list is a plain set of segment
                                // ids; it is rendered through the same row so
                                // the two blocks read alike, with `all-except`
                                // standing for "these never get in" and
                                // `inherit` withheld — an exclusion is absolute
                                // by definition and has nothing to inherit from.
                                condition={{
                                    mode: exclusions[type.key]?.length
                                        ? 'all-except'
                                        : 'all',
                                    segmentIds: exclusions[type.key] ?? []
                                }}
                                allowInherit={false}
                                disabled={disabled}
                                container={content}
                                onChange={(condition) =>
                                    setExclusions((current) => ({
                                        ...current,
                                        [type.key]:
                                            condition.mode === 'all'
                                                ? []
                                                : condition.segmentIds
                                    }))
                                }
                            />
                        ))}
                    </section>

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                            <FieldLabel htmlFor="rule-starts">
                                {intl.formatMessage(messages.window)}
                            </FieldLabel>
                            <DateTimePicker
                                id="rule-starts"
                                value={startsAt}
                                disabled={disabled}
                                placeholder={intl.formatMessage(
                                    messages.pickDate
                                )}
                                onChange={setStartsAt}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="rule-ends">
                                {intl.formatMessage(messages.windowUntil)}
                            </FieldLabel>
                            <DateTimePicker
                                id="rule-ends"
                                value={endsAt}
                                disabled={disabled}
                                placeholder={intl.formatMessage(
                                    messages.pickDate
                                )}
                                onChange={setEndsAt}
                            />
                            <FieldDescription>
                                {intl.formatMessage(messages.windowHint)}
                            </FieldDescription>
                        </Field>
                    </div>

                    <Field>
                        <FieldLabel htmlFor="rule-fallback">
                            {intl.formatMessage(messages.fallback)}
                        </FieldLabel>
                        <Select
                            value={fallback}
                            disabled={disabled}
                            onValueChange={(value) =>
                                setFallback(value as AccessFallback)
                            }
                        >
                            <SelectTrigger id="rule-fallback">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="hidden">
                                    {intl.formatMessage(
                                        messages.fallbackHidden
                                    )}
                                </SelectItem>
                                <SelectItem value="teaser">
                                    {intl.formatMessage(
                                        messages.fallbackTeaser
                                    )}
                                </SelectItem>
                                <SelectItem value="paywall">
                                    {intl.formatMessage(
                                        messages.fallbackPaywall
                                    )}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        {intl.formatMessage(
                            editable ? messages.cancel : messages.close
                        )}
                    </Button>
                    {editable ? (
                        <Button
                            type="submit"
                            form="rule-form"
                            disabled={!valid || disabled}
                        >
                            {submitting ? <Spinner /> : null}
                            {intl.formatMessage(
                                editing
                                    ? messages.submitEdit
                                    : messages.submitCreate
                            )}
                        </Button>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** A group copied deeply enough that editing the draft cannot mutate the cache. */
function cloneGroup(group: ConditionGroup): ConditionGroup {
    return {
        conditions: Object.fromEntries(
            Object.entries(group.conditions).map(([typeKey, condition]) => [
                typeKey,
                { mode: condition.mode, segmentIds: [...condition.segmentIds] }
            ])
        )
    };
}

/**
 * The exclusions, copied the same way.
 *
 * TanStack hands out the cached object itself, so a draft that shares arrays
 * with it would edit the list the table is rendering — and a cancelled dialog
 * would leave those edits behind, with nothing to refetch them.
 */
function structuredCloneExclusions(
    exclusions: Record<string, string[]>
): Record<string, string[]> {
    return Object.fromEntries(
        Object.entries(exclusions).map(([typeKey, ids]) => [typeKey, [...ids]])
    );
}
