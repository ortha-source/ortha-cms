import { useEffect, useId, useState, type RefObject } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Info } from 'lucide-react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    SegmentedControl,
    SegmentedControlItem,
    Switch,
    toast
} from '@orthacms/design-system';
import {
    DEFAULT_PROTECTION_RULE,
    REQUIRED_APPROVALS_MAX,
    blocksEveryone,
    type ProtectedTypeRow,
    type ProtectionRule
} from '../../../../domain/types';
import {
    APPROVAL_PRESETS,
    approvalSegment,
    readRule
} from '../../../../domain/ruleSummary';
import {
    useDeleteProtectionRule,
    useSaveProtectionRule
} from '../../../../application/hooks';

const messages = defineMessages({
    title: {
        id: 'protection.settings.editor.title',
        defaultMessage: 'Publishing {label}'
    },
    body: {
        id: 'protection.settings.editor.body',
        defaultMessage: 'Who must approve before a record in {label} goes live.'
    },
    enabled: {
        id: 'protection.settings.editor.enabled',
        defaultMessage: 'Require review before publishing'
    },
    enabledHelp: {
        id: 'protection.settings.editor.enabledHelp',
        defaultMessage:
            'Every publish of a record in {label} needs approvals first.'
    },
    count: {
        id: 'protection.settings.editor.count',
        defaultMessage: 'Approvals needed'
    },
    other: {
        id: 'protection.settings.editor.countOther',
        defaultMessage: 'Other…'
    },
    otherCount: {
        id: 'protection.settings.editor.countOtherInput',
        defaultMessage: 'Number of approvals'
    },
    otherPerson: {
        id: 'protection.settings.editor.otherPerson',
        defaultMessage: 'The author can’t approve their own changes'
    },
    stale: {
        id: 'protection.settings.editor.stale',
        defaultMessage: 'Keep approvals across new saves'
    },
    staleHelp: {
        id: 'protection.settings.editor.staleHelp',
        defaultMessage: 'Off: any save after an approval asks again.'
    },
    bypass: {
        id: 'protection.settings.editor.bypass',
        defaultMessage: 'Admins may publish without review'
    },
    bypassHelp: {
        id: 'protection.settings.editor.bypassHelp',
        defaultMessage: 'They confirm it, and it is recorded in Activity.'
    },
    token: {
        id: 'protection.settings.editor.token',
        defaultMessage: 'API tokens may publish'
    },
    tokenHelp: {
        id: 'protection.settings.editor.tokenHelp',
        defaultMessage:
            'A token still needs the approvals. Off, it can’t publish this type at all.'
    },
    inShort: {
        id: 'protection.settings.editor.inShort',
        defaultMessage: 'In short:'
    },
    sentenceOff: {
        id: 'protection.settings.editor.sentenceOff',
        defaultMessage: 'a record in {label} publishes without review.'
    },
    sentenceCount: {
        id: 'protection.settings.editor.sentenceCount',
        defaultMessage:
            'a record in {label} needs {count, plural, one {# approval} other {# approvals}}'
    },
    sentenceFromOthers: {
        id: 'protection.settings.editor.sentenceFromOthers',
        defaultMessage:
            '{count, plural, one {from someone other than its author} other {from people other than its author}}'
    },
    authorMayApprove: {
        id: 'protection.settings.editor.sentence.authorMayApprove',
        defaultMessage: 'its author’s own approval counts'
    },
    keepsAcrossSaves: {
        id: 'protection.settings.editor.sentence.keepsAcrossSaves',
        defaultMessage: 'approvals stay after a new save'
    },
    adminsOverride: {
        id: 'protection.settings.editor.sentence.adminsOverride',
        defaultMessage: 'admins can override'
    },
    tokensPublish: {
        id: 'protection.settings.editor.sentence.tokensPublish',
        defaultMessage: 'API tokens may publish it once approved'
    },
    aloneTitle: {
        id: 'protection.settings.editor.aloneTitle',
        defaultMessage: 'Nobody could publish this type'
    },
    aloneBody: {
        id: 'protection.settings.editor.aloneBody',
        defaultMessage:
            'This workspace has one member, and the author cannot approve their own version — so no entry of this type could be published except by an administrator overriding the rule.'
    },
    readOnly: {
        id: 'protection.settings.editor.readOnly',
        defaultMessage: 'You can view this rule but not change it.'
    },
    cancel: {
        id: 'protection.settings.editor.cancel',
        defaultMessage: 'Cancel'
    },
    save: { id: 'protection.settings.editor.save', defaultMessage: 'Save' },
    saving: {
        id: 'protection.settings.editor.saving',
        defaultMessage: 'Saving…'
    },
    remove: {
        id: 'protection.settings.editor.remove',
        defaultMessage: 'Remove rule'
    },
    saved: {
        id: 'protection.settings.editor.saved',
        defaultMessage: 'Publishing rule saved for {label}.'
    },
    removed: {
        id: 'protection.settings.editor.removed',
        defaultMessage: 'Publishing rule removed from {label}.'
    },
    failed: {
        id: 'protection.settings.editor.failed',
        defaultMessage: 'That change could not be saved.'
    }
});

/** The four boolean options after the count, so the list is declared once. */
type OptionKey =
    | 'requireOtherPerson'
    | 'countStaleApprovals'
    | 'adminBypass'
    | 'allowTokenPublish';

/**
 * The publishing rule for one content type — switches in plain words, and a
 * sentence under them that reads the rule back.
 *
 * **It edits all six fields and submits all six**, because `PUT` replaces
 * rather than patches: a form that sent only what it showed would silently
 * reset the rest to their defaults, and "what does this rule do" would become a
 * question about the order somebody edited it in.
 *
 * **The "In short" sentence is the point of the redesign.** A row of switches
 * says what each one does; only a sentence says what they do together, and
 * "count approvals from earlier versions" stops being a puzzle once the dialog
 * reads the whole rule back. It comes from `readRule`, the same reading the
 * settings list's one-line hint uses, so the two cannot describe one rule two
 * ways.
 *
 * The count is three quick picks and **Other…**, which reveals a real number
 * input — the picks are a radio group (arrow keys, a value a screen reader reads
 * back) and the input keeps the clamp on whatever is typed.
 *
 * It restores focus itself. The dialog is mounted only while a row is being
 * edited, so closing it unmounts the whole subtree in the same commit — and
 * Radix's own restore, which runs against the node it captured on mount, never
 * gets the chance. The trigger is captured at the moment of the click instead.
 *
 * The one-member warning is a **live region**, not a paragraph. Somebody who
 * has just flipped a toggle is looking at the toggle; a warning that only
 * appears below it is a warning they meet a week later, when a publish fails
 * for a reason nothing on the screen explains. ADR-0017 accepts that a
 * one-person workspace blocks itself and says the interface must name it at the
 * moment the rule is switched on — this is that moment.
 */
export function RuleEditorDialog({
    open,
    onOpenChange,
    row,
    workspaceId,
    memberCount,
    canManage,
    returnFocusTo
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The type being edited, with the rule it already holds. */
    row: ProtectedTypeRow;
    /** The open workspace — the rules cache is keyed by it. */
    workspaceId: string;
    /** How many people belong to the workspace, for the four-eyes warning. */
    memberCount: number;
    /** Whether this person holds `protection:manage`. */
    canManage: boolean;
    /** The control that opened this, so closing puts focus back on it. */
    returnFocusTo?: RefObject<HTMLElement | null>;
}) {
    const intl = useIntl();
    const baseId = useId();
    const save = useSaveProtectionRule(workspaceId);
    const remove = useDeleteProtectionRule(workspaceId);

    const stored: ProtectionRule = row.rule ?? DEFAULT_PROTECTION_RULE;
    const [draft, setDraft] = useState<ProtectionRule>(stored);
    // "Other…" is a choice of its own: picking it keeps the count as it is and
    // reveals the input, rather than snapping back to the preset it matches.
    const [otherCount, setOtherCount] = useState(
        approvalSegment(stored.requiredApprovals) === 'other'
    );

    // Re-baseline when the dialog opens: a rule another administrator changed
    // while this was closed must not be overwritten by a stale form.
    useEffect(() => {
        if (!open) return;
        const next = row.rule ?? DEFAULT_PROTECTION_RULE;
        setDraft(next);
        setOtherCount(approvalSegment(next.requiredApprovals) === 'other');
    }, [open, row.rule]);

    const set = <K extends keyof ProtectionRule>(
        key: K,
        value: ProtectionRule[K]
    ) => setDraft((current) => ({ ...current, [key]: value }));

    const alone = blocksEveryone(draft, memberCount);
    const busy = save.isPending || remove.isPending;
    const label = row.label;
    const segment = otherCount
        ? 'other'
        : approvalSegment(draft.requiredApprovals);

    const options: { key: OptionKey; label: string; help?: string }[] = [
        {
            key: 'requireOtherPerson',
            label: intl.formatMessage(messages.otherPerson)
        },
        {
            key: 'countStaleApprovals',
            label: intl.formatMessage(messages.stale),
            help: intl.formatMessage(messages.staleHelp)
        },
        {
            key: 'adminBypass',
            label: intl.formatMessage(messages.bypass),
            help: intl.formatMessage(messages.bypassHelp)
        },
        {
            key: 'allowTokenPublish',
            label: intl.formatMessage(messages.token),
            help: intl.formatMessage(messages.tokenHelp)
        }
    ];

    const reading = readRule(draft);
    const sentence =
        reading.kind === 'off'
            ? intl.formatMessage(messages.sentenceOff, { label })
            : `${[
                  [
                      intl.formatMessage(messages.sentenceCount, {
                          label,
                          count: reading.count
                      }),
                      reading.fromOthers
                          ? intl.formatMessage(messages.sentenceFromOthers, {
                                count: reading.count
                            })
                          : null
                  ]
                      .filter(Boolean)
                      .join(' '),
                  ...reading.exceptions.map((exception) =>
                      intl.formatMessage(messages[exception])
                  )
              ].join('; ')}.`;

    const submit = () =>
        save.mutate(
            { kind: row.kind, slug: row.slug, rule: draft },
            {
                onSuccess: () => {
                    toast.success(
                        intl.formatMessage(messages.saved, { label })
                    );
                    onOpenChange(false);
                },
                onError: () => toast.error(intl.formatMessage(messages.failed))
            }
        );

    const drop = () =>
        remove.mutate(
            { kind: row.kind, slug: row.slug },
            {
                onSuccess: () => {
                    toast.success(
                        intl.formatMessage(messages.removed, { label })
                    );
                    onOpenChange(false);
                },
                onError: () => toast.error(intl.formatMessage(messages.failed))
            }
        );

    const countLabelId = `${baseId}-count`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-[560px]"
                onCloseAutoFocus={(event) => {
                    const target = returnFocusTo?.current;
                    // Focusing a detached node silently does nothing, which is
                    // worse than letting Radix try — so only take over when the
                    // trigger is certainly still there.
                    if (target?.isConnected) {
                        event.preventDefault();
                        target.focus();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, { label })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.body, { label })}
                    </DialogDescription>
                </DialogHeader>

                {/* Said in text, not implied by greyed-out controls. */}
                {!canManage ? (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.readOnly)}
                    </p>
                ) : null}

                <div className="flex flex-col gap-4">
                    <SwitchRow
                        id={`${baseId}-enabled`}
                        label={intl.formatMessage(messages.enabled)}
                        help={intl.formatMessage(messages.enabledHelp, {
                            label
                        })}
                        checked={draft.enabled}
                        disabled={!canManage}
                        onCheckedChange={(next) => set('enabled', next)}
                    />

                    <div className="flex flex-col gap-2">
                        <span id={countLabelId} className="text-sm font-medium">
                            {intl.formatMessage(messages.count)}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                            <SegmentedControl
                                variant="muted"
                                aria-labelledby={countLabelId}
                                className="self-start"
                                value={segment}
                                disabled={!canManage}
                                onValueChange={(next) => {
                                    // Re-pressing the selected segment
                                    // reports '' — it is still selected.
                                    if (!next) return;
                                    if (next === 'other') {
                                        setOtherCount(true);
                                        return;
                                    }
                                    setOtherCount(false);
                                    set('requiredApprovals', Number(next));
                                }}
                            >
                                {APPROVAL_PRESETS.map((preset) => (
                                    <SegmentedControlItem
                                        key={preset}
                                        value={String(preset)}
                                        className="min-w-8 justify-center px-2.5"
                                    >
                                        {intl.formatNumber(preset)}
                                    </SegmentedControlItem>
                                ))}
                                <SegmentedControlItem
                                    value="other"
                                    className="px-2.5"
                                >
                                    {intl.formatMessage(messages.other)}
                                </SegmentedControlItem>
                            </SegmentedControl>
                            {otherCount ? (
                                <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={REQUIRED_APPROVALS_MAX}
                                    className="h-8 w-20"
                                    aria-label={intl.formatMessage(
                                        messages.otherCount
                                    )}
                                    disabled={!canManage}
                                    value={draft.requiredApprovals}
                                    onChange={(event) =>
                                        set(
                                            'requiredApprovals',
                                            clamp(Number(event.target.value))
                                        )
                                    }
                                />
                            ) : null}
                        </div>
                    </div>

                    {options.map(({ key, label: optionLabel, help }) => (
                        <SwitchRow
                            key={key}
                            id={`${baseId}-${key}`}
                            label={optionLabel}
                            help={help}
                            checked={draft[key]}
                            disabled={!canManage}
                            onCheckedChange={(next) => set(key, next)}
                        />
                    ))}

                    {/* The rule read back as one sentence — what the switches
                        do together, which no single switch says. */}
                    <div className="flex gap-2.5 rounded-lg border border-info/30 bg-info-soft px-3.5 py-3 text-sm text-info-soft-foreground">
                        <Info
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0 text-info"
                        />
                        <p>
                            <b className="font-semibold">
                                {intl.formatMessage(messages.inShort)}
                            </b>{' '}
                            {sentence}
                        </p>
                    </div>
                </div>

                {/* Announced, not merely rendered — see the component's note. */}
                <div role="status" aria-live="polite">
                    {alone ? (
                        <div className="rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning-soft-foreground">
                            <p className="font-medium">
                                {intl.formatMessage(messages.aloneTitle)}
                            </p>
                            <p className="mt-1">
                                {intl.formatMessage(messages.aloneBody)}
                            </p>
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="items-center border-t pt-4 sm:justify-between">
                    <div>
                        {canManage && row.rule ? (
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={drop}
                                disabled={busy}
                            >
                                {intl.formatMessage(messages.remove)}
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={busy}
                        >
                            {intl.formatMessage(messages.cancel)}
                        </Button>
                        {canManage ? (
                            <Button
                                type="button"
                                onClick={submit}
                                disabled={busy}
                            >
                                {intl.formatMessage(
                                    busy ? messages.saving : messages.save
                                )}
                            </Button>
                        ) : null}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * One switch with its label beside it and an optional line of help under the
 * label — the board's row. The switch is named by the label and described by
 * the help, so a screen reader reads both.
 */
function SwitchRow({
    id,
    label,
    help,
    checked,
    disabled,
    onCheckedChange
}: {
    id: string;
    label: string;
    help?: string;
    checked: boolean;
    disabled: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    const helpId = `${id}-help`;
    return (
        <div className="flex items-start gap-3">
            <Switch
                id={id}
                checked={checked}
                disabled={disabled}
                aria-describedby={help ? helpId : undefined}
                onCheckedChange={onCheckedChange}
                className="mt-0.5"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor={id} className="leading-5">
                    {label}
                </Label>
                {help ? (
                    <span
                        id={helpId}
                        className="text-[13px] leading-5 text-muted-foreground"
                    >
                        {help}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

/** Clamps a typed count into the range the API stores. */
function clamp(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.min(REQUIRED_APPROVALS_MAX, Math.max(1, Math.trunc(value)));
}
