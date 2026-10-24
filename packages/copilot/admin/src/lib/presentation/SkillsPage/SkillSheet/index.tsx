import { useEffect, useId, useState, type FormEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    InputField,
    Label,
    RadioGroup,
    RadioGroupItem,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    Switch,
    Textarea,
    cn
} from '@orthacms/design-system';
import {
    MAX_SKILL_DESCRIPTION_LENGTH,
    MAX_SKILL_INSTRUCTIONS_LENGTH,
    SKILL_NAME_PATTERN
} from '@orthacms/copilot-domain';
import type { CopilotSkillDetail } from '../../../application/useManageSkills';

const messages = defineMessages({
    createTitle: {
        id: 'copilot.skills.form.createTitle',
        defaultMessage: 'New skill'
    },
    editTitle: {
        id: 'copilot.skills.form.editTitle',
        defaultMessage: 'Edit skill'
    },
    explain: {
        id: 'copilot.skills.form.explain',
        defaultMessage:
            'Instructions the assistant follows when the skill is on.'
    },
    title: { id: 'copilot.skills.form.title', defaultMessage: 'Name' },
    slug: { id: 'copilot.skills.form.slug', defaultMessage: 'Identifier' },
    description: {
        id: 'copilot.skills.form.description',
        defaultMessage: 'When to use it'
    },
    descriptionHint: {
        id: 'copilot.skills.form.descriptionHint',
        defaultMessage:
            'Shown when people pick skills. {used, number} / {max, number}'
    },
    instructions: {
        id: 'copilot.skills.form.instructions',
        defaultMessage: 'Instructions'
    },
    instructionsCount: {
        id: 'copilot.skills.form.instructionsCount',
        defaultMessage: '{used, number} / {max, number}'
    },
    mode: { id: 'copilot.skills.form.mode', defaultMessage: 'Applies' },
    modeManual: {
        id: 'copilot.skills.form.modeManual',
        defaultMessage: 'When someone turns it on'
    },
    modeManualHint: {
        id: 'copilot.skills.form.modeManualHint',
        defaultMessage: 'From the message box.'
    },
    modeAlways: {
        id: 'copilot.skills.form.modeAlways',
        defaultMessage: 'Every chat here'
    },
    modeAlwaysHint: {
        id: 'copilot.skills.form.modeAlwaysHint',
        defaultMessage: 'In {workspace}.'
    },
    enabled: {
        id: 'copilot.skills.form.enabled',
        defaultMessage: 'Available'
    },
    save: { id: 'copilot.skills.form.save', defaultMessage: 'Save skill' },
    saving: { id: 'copilot.skills.form.saving', defaultMessage: 'Saving…' },
    cancel: { id: 'copilot.skills.form.cancel', defaultMessage: 'Cancel' },
    close: { id: 'copilot.skills.form.close', defaultMessage: 'Close' },
    nameInvalid: {
        id: 'copilot.skills.form.nameInvalid',
        defaultMessage:
            'Use lowercase letters, digits and hyphens — for example house-style.'
    },
    required: {
        id: 'copilot.skills.form.required',
        defaultMessage: 'This is required.'
    },
    tooLong: {
        id: 'copilot.skills.form.tooLong',
        defaultMessage:
            '{over, number} {over, plural, one {character} other {characters}} over the limit.'
    }
});

/** What the sheet hands back on save. */
export interface SkillFormValues {
    name: string;
    title: string;
    description: string;
    instructions: string;
    mode: 'manual' | 'always';
    enabled: boolean;
}

export interface SkillSheetProps {
    open: boolean;
    /** The skill being edited, or `null` to create one. */
    skill: CopilotSkillDetail | null;
    /** Named in the "Every chat here" card. */
    workspaceName: string;
    /** True while the record behind an edit is still loading. */
    loading?: boolean;
    /** True while a save is in flight. */
    saving?: boolean;
    /** The server's reason for refusing the last save, when it refused one. */
    error?: string | null;
    onSubmit(values: SkillFormValues): void;
    onOpenChange(open: boolean): void;
}

/** A blank skill. */
const EMPTY: SkillFormValues = {
    name: '',
    title: '',
    description: '',
    instructions: '',
    mode: 'manual',
    enabled: true
};

/** The red asterisk after a required field's label; the input says it too. */
function Required() {
    return (
        <span aria-hidden className="text-destructive ml-0.5 select-none">
            *
        </span>
    );
}

/**
 * Create and edit, **in a sheet over the list** (R7, `AiSkillEditor`): name
 * and identifier side by side, "when to use it" with its count, the
 * instructions as the big field with theirs, and "applies" as two cards.
 *
 * A sheet rather than the dialog it was: the instructions are the field that
 * matters and they want height, and the list behind stays in view so the
 * person can see the skills they are writing alongside.
 *
 * **Save is disabled only while saving, never on a validation error.** A greyed
 * out Save refuses without saying why — submitting is what surfaces the reason.
 *
 * The identifier follows the name **while creating** and stops the moment
 * anyone edits either one by hand. Editing an existing skill never re-links
 * them: a run names a skill by its identifier, so having it change under a
 * title edit would silently un-attach the skill from every composer holding it
 * staged.
 *
 * The two counters are text, not a hard cap: no `maxLength`, so a pasted body
 * that is too long gets an explanation instead of a silent truncation.
 */
export function SkillSheet({
    open,
    skill,
    workspaceName,
    loading = false,
    saving = false,
    error,
    onSubmit,
    onOpenChange
}: SkillSheetProps) {
    const intl = useIntl();
    const id = useId();
    const [values, setValues] = useState<SkillFormValues>(EMPTY);
    const [touched, setTouched] = useState(false);
    // Whether the identifier is still following the name.
    const [linked, setLinked] = useState(true);

    // Reset when the sheet opens onto a different skill — keyed on the record
    // rather than on `open` alone, so a failed save keeps the edit.
    useEffect(() => {
        if (!open) {
            return;
        }
        setTouched(false);
        setLinked(!skill);
        setValues(
            skill
                ? {
                      name: skill.name,
                      title: skill.title,
                      description: skill.description,
                      instructions: skill.instructions,
                      mode: skill.mode,
                      enabled: skill.enabled
                  }
                : EMPTY
        );
    }, [open, skill]);

    const set = <K extends keyof SkillFormValues>(
        key: K,
        value: SkillFormValues[K]
    ) => setValues((current) => ({ ...current, [key]: value }));

    const nameProblem =
        values.name.length > 0 && !SKILL_NAME_PATTERN.test(values.name)
            ? intl.formatMessage(messages.nameInvalid)
            : undefined;
    const descriptionOver =
        values.description.length - MAX_SKILL_DESCRIPTION_LENGTH;
    const instructionsOver =
        values.instructions.length - MAX_SKILL_INSTRUCTIONS_LENGTH;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setTouched(true);
        if (
            !values.title.trim() ||
            !values.description.trim() ||
            !values.instructions.trim() ||
            !SKILL_NAME_PATTERN.test(values.name) ||
            descriptionOver > 0 ||
            instructionsOver > 0
        ) {
            return;
        }
        onSubmit(values);
    };

    const missing = (value: string) =>
        touched && !value.trim()
            ? intl.formatMessage(messages.required)
            : undefined;
    const over = (count: number) =>
        count > 0
            ? intl.formatMessage(messages.tooLong, { over: count })
            : undefined;

    const instructionsError =
        over(instructionsOver) ?? missing(values.instructions);
    const instructionsCountId = `${id}-instructions-count`;
    const instructionsErrorId = `${id}-instructions-error`;
    const modeLabelId = `${id}-mode`;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                closeLabel={intl.formatMessage(messages.close)}
                className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]"
            >
                <SheetHeader className="gap-1 space-y-0 border-b px-5 pt-5 pb-4">
                    <SheetTitle className="text-[17px]">
                        {intl.formatMessage(
                            skill ? messages.editTitle : messages.createTitle
                        )}
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                        {intl.formatMessage(messages.explain)}
                    </SheetDescription>
                </SheetHeader>

                <form
                    onSubmit={submit}
                    className="flex min-h-0 flex-1 flex-col"
                    noValidate
                >
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <InputField
                                id={`${id}-title`}
                                label={
                                    <>
                                        {intl.formatMessage(messages.title)}
                                        <Required />
                                    </>
                                }
                                value={values.title}
                                disabled={loading}
                                required
                                error={missing(values.title)}
                                onChange={(event) => {
                                    const title = event.target.value;
                                    set('title', title);
                                    if (linked) {
                                        set('name', slugify(title));
                                    }
                                }}
                            />
                            <InputField
                                id={`${id}-name`}
                                label={
                                    <>
                                        {intl.formatMessage(messages.slug)}
                                        <Required />
                                    </>
                                }
                                value={values.name}
                                disabled={loading}
                                required
                                className="font-mono text-[13px]"
                                error={nameProblem ?? missing(values.name)}
                                onChange={(event) => {
                                    setLinked(false);
                                    set('name', event.target.value);
                                }}
                            />
                        </div>

                        <InputField
                            id={`${id}-description`}
                            label={intl.formatMessage(messages.description)}
                            description={intl.formatMessage(
                                messages.descriptionHint,
                                {
                                    used: values.description.length,
                                    max: MAX_SKILL_DESCRIPTION_LENGTH
                                }
                            )}
                            value={values.description}
                            disabled={loading}
                            required
                            error={
                                over(descriptionOver) ??
                                missing(values.description)
                            }
                            onChange={(event) =>
                                set('description', event.target.value)
                            }
                        />

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`${id}-instructions`}>
                                {intl.formatMessage(messages.instructions)}
                                <Required />
                            </Label>
                            <Textarea
                                id={`${id}-instructions`}
                                value={values.instructions}
                                disabled={loading}
                                required
                                aria-invalid={Boolean(
                                    touched && instructionsError
                                )}
                                aria-describedby={[
                                    instructionsCountId,
                                    instructionsError ? instructionsErrorId : ''
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                className="h-[200px] resize-y text-[13px] leading-[19px]"
                                onChange={(event) =>
                                    set('instructions', event.target.value)
                                }
                            />
                            <div className="flex items-start justify-between gap-3 text-xs">
                                {instructionsError ? (
                                    <p
                                        id={instructionsErrorId}
                                        className="text-destructive"
                                    >
                                        {instructionsError}
                                    </p>
                                ) : (
                                    <span />
                                )}
                                <span
                                    id={instructionsCountId}
                                    className={cn(
                                        'shrink-0 tabular-nums',
                                        instructionsOver > 0
                                            ? 'text-destructive'
                                            : 'text-muted-foreground'
                                    )}
                                >
                                    {intl.formatMessage(
                                        messages.instructionsCount,
                                        {
                                            used: values.instructions.length,
                                            max: MAX_SKILL_INSTRUCTIONS_LENGTH
                                        }
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <span
                                id={modeLabelId}
                                className="text-sm leading-none font-medium"
                            >
                                {intl.formatMessage(messages.mode)}
                            </span>
                            {/* Two cards, the radio and its sentence in one
                                target — the shape every "which of two
                                behaviours" choice in the admin takes. */}
                            <RadioGroup
                                aria-labelledby={modeLabelId}
                                value={values.mode}
                                onValueChange={(mode) =>
                                    set('mode', mode as 'manual' | 'always')
                                }
                                className="grid gap-2.5 sm:grid-cols-2"
                            >
                                {(
                                    [
                                        {
                                            value: 'manual',
                                            title: intl.formatMessage(
                                                messages.modeManual
                                            ),
                                            hint: intl.formatMessage(
                                                messages.modeManualHint
                                            )
                                        },
                                        {
                                            value: 'always',
                                            title: intl.formatMessage(
                                                messages.modeAlways
                                            ),
                                            hint: intl.formatMessage(
                                                messages.modeAlwaysHint,
                                                { workspace: workspaceName }
                                            )
                                        }
                                    ] as const
                                ).map((option) => (
                                    <Label
                                        key={option.value}
                                        htmlFor={`${id}-mode-${option.value}`}
                                        className={cn(
                                            'hover:bg-muted/40 flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 font-normal transition-colors',
                                            values.mode === option.value &&
                                                'border-foreground ring-foreground ring-1'
                                        )}
                                    >
                                        <RadioGroupItem
                                            id={`${id}-mode-${option.value}`}
                                            value={option.value}
                                            className="mt-0.5"
                                        />
                                        <span className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">
                                                {option.title}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {option.hint}
                                            </span>
                                        </span>
                                    </Label>
                                ))}
                            </RadioGroup>
                        </div>

                        <div className="flex items-center gap-3">
                            <Switch
                                id={`${id}-enabled`}
                                checked={values.enabled}
                                onCheckedChange={(checked) =>
                                    set('enabled', checked)
                                }
                            />
                            <Label htmlFor={`${id}-enabled`}>
                                {intl.formatMessage(messages.enabled)}
                            </Label>
                        </div>

                        {error ? (
                            <p
                                role="alert"
                                className="text-destructive text-sm"
                            >
                                {error}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex justify-end gap-2 border-t px-5 py-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {intl.formatMessage(messages.cancel)}
                        </Button>
                        <Button type="submit" disabled={saving || loading}>
                            {intl.formatMessage(
                                saving ? messages.saving : messages.save
                            )}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}

/**
 * A title turned into a candidate identifier.
 *
 * Only a starting point — the field stays editable, and it stops following the
 * title the moment anyone touches it. Non-ASCII is dropped rather than
 * transliterated: a guessed romanisation of someone's language is worse than an
 * empty field they fill in themselves.
 */
function slugify(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}
