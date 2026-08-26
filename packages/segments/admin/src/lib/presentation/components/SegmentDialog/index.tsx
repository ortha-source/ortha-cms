import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { slugify } from '@orthacms/utils-admin';
import {
    isValidSegment,
    validateSegment,
    SEGMENT_ISSUE,
    SEGMENT_KEY_MAX,
    SEGMENT_LABEL_MAX,
    SEGMENT_TAG_MAX,
    SEGMENT_TAGS_MAX,
    type SegmentIssue,
    type SegmentIssues
} from '@orthacms/segments-domain';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    Input,
    Spinner,
    Textarea
} from '@orthacms/design-system';
import type { Segment } from '../../../domain/types';

const messages = defineMessages({
    createTitle: {
        id: 'segments.dialog.createTitle',
        defaultMessage: 'New audience'
    },
    createBody: {
        id: 'segments.dialog.createBody',
        defaultMessage:
            'A group of readers you want to decide about — a customer, a plan, a region. Entries then say which audiences may read them.'
    },
    editTitle: {
        id: 'segments.dialog.editTitle',
        defaultMessage: 'Edit audience'
    },
    editBody: {
        id: 'segments.dialog.editBody',
        defaultMessage:
            'Changing the tags changes who this audience matches — immediately, on every entry that names it.'
    },
    label: { id: 'segments.dialog.label', defaultMessage: 'Name' },
    key: { id: 'segments.dialog.key', defaultMessage: 'Key' },
    keyHint: {
        id: 'segments.dialog.keyHint',
        defaultMessage:
            'Lowercase letters, digits, and . _ - — permanent, and the default reader tag.'
    },
    tags: { id: 'segments.dialog.tags', defaultMessage: 'Reader tags' },
    tagsHint: {
        id: 'segments.dialog.tagsHint',
        defaultMessage:
            'One per line — the identifiers your readers arrive with. Any one is enough to match. Leave empty to use just “{key}”.'
    },
    tagsCount: {
        id: 'segments.dialog.tagsCount',
        defaultMessage: '{count} of {max} tags'
    },
    submitCreate: {
        id: 'segments.dialog.submitCreate',
        defaultMessage: 'Create'
    },
    submitEdit: { id: 'segments.dialog.submitEdit', defaultMessage: 'Save' },
    cancel: { id: 'segments.dialog.cancel', defaultMessage: 'Cancel' },

    // One message per (field, reason) rather than a generic "invalid": the
    // whole point of validating here is telling somebody what to change.
    labelRequired: {
        id: 'segments.dialog.labelRequired',
        defaultMessage: 'Give the audience a name.'
    },
    labelTooLong: {
        id: 'segments.dialog.labelTooLong',
        defaultMessage: 'Keep the name under {max} characters.'
    },
    keyRequired: {
        id: 'segments.dialog.keyRequired',
        defaultMessage: 'A key is required — it is how the audience is matched.'
    },
    keyMalformed: {
        id: 'segments.dialog.keyMalformed',
        defaultMessage:
            'Use lowercase letters, digits, and . _ - only, starting with a letter or digit. It becomes a reader tag, so a space or a capital would match nobody.'
    },
    keyTooLong: {
        id: 'segments.dialog.keyTooLong',
        defaultMessage: 'Keep the key under {max} characters.'
    },
    keyDuplicate: {
        id: 'segments.dialog.keyDuplicate',
        defaultMessage: 'An audience with this key already exists.'
    },
    tagsTooMany: {
        id: 'segments.dialog.tagsTooMany',
        defaultMessage: 'At most {max} tags.'
    },
    tagsTooLong: {
        id: 'segments.dialog.tagsTooLong',
        defaultMessage: 'One of the tags is over {max} characters.'
    },
    tagsDuplicate: {
        id: 'segments.dialog.tagsDuplicate',
        defaultMessage: 'The same tag is listed twice.'
    }
});

/** Which message a field's issue renders as, with its parameter. */
const COPY: Record<
    keyof SegmentIssues,
    Partial<
        Record<
            SegmentIssue,
            { message: { id: string; defaultMessage: string }; max?: number }
        >
    >
> = {
    label: {
        [SEGMENT_ISSUE.Required]: { message: messages.labelRequired },
        [SEGMENT_ISSUE.TooLong]: {
            message: messages.labelTooLong,
            max: SEGMENT_LABEL_MAX
        }
    },
    key: {
        [SEGMENT_ISSUE.Required]: { message: messages.keyRequired },
        [SEGMENT_ISSUE.Malformed]: { message: messages.keyMalformed },
        [SEGMENT_ISSUE.TooLong]: {
            message: messages.keyTooLong,
            max: SEGMENT_KEY_MAX
        },
        [SEGMENT_ISSUE.Duplicate]: { message: messages.keyDuplicate }
    },
    tags: {
        [SEGMENT_ISSUE.TooMany]: {
            message: messages.tagsTooMany,
            max: SEGMENT_TAGS_MAX
        },
        [SEGMENT_ISSUE.TooLong]: {
            message: messages.tagsTooLong,
            max: SEGMENT_TAG_MAX
        },
        [SEGMENT_ISSUE.Duplicate]: { message: messages.tagsDuplicate }
    }
};

/** What the dialog submits. */
export type SegmentDraft = {
    key: string;
    label: string;
    tags: string[];
};

/** Props for {@link SegmentDialog}. */
type SegmentDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The segment being edited, or `null` to create one. */
    editing: Segment | null;
    /**
     * Every existing key, so a collision is caught before the submit.
     *
     * It may be **incomplete** — the page draws it from the list it is
     * showing, which a search narrows. That can only ever miss a collision, not
     * invent one, and {@link keyConflict} is what catches the rest.
     */
    existingKeys: readonly string[];
    /**
     * The key the server last refused with a 409, or `null`.
     *
     * The **key** and not a flag, so the message clears the moment somebody
     * types a different one — a boolean would need a callback to reset and
     * would otherwise sit there contradicting a field they have already fixed.
     *
     * The local check covers the common case; this covers the two it cannot —
     * a key a search filtered out of the list, and two people creating the same
     * one at once. Without it the refusal arrives as a toast about a field that
     * is still on screen and still looks fine.
     */
    keyConflict: string | null;
    onSubmit: (draft: SegmentDraft) => void;
    submitting: boolean;
};

/**
 * Create or edit an audience.
 *
 * **The rules come from the kernel**, not from a pattern spelled out here:
 * `@orthacms/segments-domain`'s `validateSegment` is the same function the
 * server's DTO reads its constants from, so this form cannot accept something
 * the API then refuses.
 *
 * **Errors appear on blur, not on the first keystroke.** A key is malformed for
 * the whole time somebody is typing it, and shouting about it from the second
 * character is noise about a state they are on their way out of. Once a field
 * has been submitted or left, it validates live — at that point the message is
 * about a value they have finished writing.
 *
 * The **key is shown only while creating**, and not merely disabled when
 * editing: a greyed-out field invites "why can't I change this", and the answer
 * — every entry that named this audience holds its id, and the key is what a
 * reader tag defaults to — does not fit in a tooltip.
 *
 * The **tags** field is a textarea of one per line rather than a chip input,
 * because the common case is pasting a list out of the system that owns the
 * identifiers, and a chip editor turns a paste of forty plan codes into forty
 * interactions.
 */
export function SegmentDialog({
    open,
    onOpenChange,
    editing,
    existingKeys,
    keyConflict,
    onSubmit,
    submitting
}: SegmentDialogProps) {
    const intl = useIntl();
    const [label, setLabel] = useState('');
    const [key, setKey] = useState('');
    const [keyTouched, setKeyTouched] = useState(false);
    const [tags, setTags] = useState('');
    const [blurred, setBlurred] = useState<Record<string, boolean>>({});
    const [submitted, setSubmitted] = useState(false);

    // Reset on every open, so a cancelled draft never bleeds into the next one.
    useEffect(() => {
        if (!open) return;
        setLabel(editing?.label ?? '');
        setKey(editing?.key ?? '');
        setKeyTouched(false);
        setTags(editing ? editing.tags.join('\n') : '');
        setBlurred({});
        setSubmitted(false);
    }, [open, editing]);

    // The key tracks the name until somebody takes it over — the same
    // convention the workspace slug follows, and right here for the same
    // reason: the derived value is correct almost always, and typing in the
    // field is what says it isn't.
    const derivedKey = keyTouched ? key : slugify(label);
    const tagList = useMemo(
        () =>
            tags
                .split('\n')
                .map((tag) => tag.trim())
                .filter(Boolean),
        [tags]
    );

    // The key a collision is checked against excludes the segment being edited,
    // so re-saving an unchanged audience is not a duplicate of itself. (Editing
    // sends no key at all, but the guard costs nothing and survives the day
    // somebody makes the key editable.)
    const otherKeys = useMemo(
        () => existingKeys.filter((existing) => existing !== editing?.key),
        [existingKeys, editing]
    );

    const issues = validateSegment(
        {
            ...(editing ? {} : { key: derivedKey }),
            label,
            tags: tagList
        },
        otherKeys
    );
    const valid = isValidSegment(issues);

    /** The message for a field, once it is due to be shown. */
    const errorFor = (field: keyof SegmentIssues): string | undefined => {
        if (!submitted && !blurred[field]) return undefined;
        const issue = issues[field];
        if (!issue) return undefined;
        const entry = COPY[field][issue];
        if (!entry) return undefined;
        return intl.formatMessage(entry.message, { max: entry.max });
    };

    const labelError = errorFor('label');
    // The server's refusal outranks the local check: it knows about keys this
    // list never saw.
    const keyError =
        keyConflict !== null && keyConflict === derivedKey && !editing
            ? intl.formatMessage(messages.keyDuplicate)
            : errorFor('key');
    const tagsError = errorFor('tags');
    const onBlur = (field: string) => () =>
        setBlurred((current) => ({ ...current, [field]: true }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(
                            editing ? messages.editTitle : messages.createTitle
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(
                            editing ? messages.editBody : messages.createBody
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="segment-form"
                    // `noValidate` because the messages are ours: the browser's
                    // bubble says something else, in a different language, and
                    // disappears on the next keystroke.
                    noValidate
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setSubmitted(true);
                        if (!valid || submitting) return;
                        onSubmit({
                            key: derivedKey,
                            label: label.trim(),
                            tags: tagList
                        });
                    }}
                >
                    <Field data-invalid={Boolean(labelError) || undefined}>
                        <FieldLabel htmlFor="segment-label">
                            {intl.formatMessage(messages.label)}
                        </FieldLabel>
                        <Input
                            id="segment-label"
                            value={label}
                            autoFocus
                            aria-invalid={Boolean(labelError)}
                            aria-describedby={
                                labelError ? 'segment-label-error' : undefined
                            }
                            onBlur={onBlur('label')}
                            onChange={(event) => setLabel(event.target.value)}
                        />
                        {labelError ? (
                            <FieldError id="segment-label-error">
                                {labelError}
                            </FieldError>
                        ) : null}
                    </Field>

                    {editing ? null : (
                        <Field data-invalid={Boolean(keyError) || undefined}>
                            <FieldLabel htmlFor="segment-key">
                                {intl.formatMessage(messages.key)}
                            </FieldLabel>
                            <Input
                                id="segment-key"
                                value={derivedKey}
                                aria-invalid={Boolean(keyError)}
                                aria-describedby={
                                    keyError
                                        ? 'segment-key-error'
                                        : 'segment-key-hint'
                                }
                                onBlur={onBlur('key')}
                                onChange={(event) => {
                                    setKeyTouched(true);
                                    setKey(event.target.value);
                                }}
                            />
                            {keyError ? (
                                <FieldError id="segment-key-error">
                                    {keyError}
                                </FieldError>
                            ) : (
                                <FieldDescription id="segment-key-hint">
                                    {intl.formatMessage(messages.keyHint)}
                                </FieldDescription>
                            )}
                        </Field>
                    )}

                    <Field data-invalid={Boolean(tagsError) || undefined}>
                        <FieldLabel htmlFor="segment-tags">
                            {intl.formatMessage(messages.tags)}
                        </FieldLabel>
                        <Textarea
                            id="segment-tags"
                            rows={4}
                            value={tags}
                            placeholder={derivedKey || 'acme'}
                            aria-invalid={Boolean(tagsError)}
                            aria-describedby={
                                tagsError
                                    ? 'segment-tags-error'
                                    : 'segment-tags-hint'
                            }
                            onBlur={onBlur('tags')}
                            onChange={(event) => setTags(event.target.value)}
                        />
                        {tagsError ? (
                            <FieldError id="segment-tags-error">
                                {tagsError}
                            </FieldError>
                        ) : (
                            <FieldDescription id="segment-tags-hint">
                                {intl.formatMessage(messages.tagsHint, {
                                    key: derivedKey || 'acme'
                                })}
                                {tagList.length > 0
                                    ? ` · ${intl.formatMessage(
                                          messages.tagsCount,
                                          {
                                              count: tagList.length,
                                              max: SEGMENT_TAGS_MAX
                                          }
                                      )}`
                                    : ''}
                            </FieldDescription>
                        )}
                    </Field>
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    {/* Not disabled on invalid: a dead button explains nothing,
                        and pressing it is how somebody with nothing focused
                        finds out which field is wrong. The submit handler
                        refuses, and marks every field due for its message. */}
                    <Button
                        type="submit"
                        form="segment-form"
                        disabled={submitting}
                    >
                        {submitting ? <Spinner /> : null}
                        {intl.formatMessage(
                            editing
                                ? messages.submitEdit
                                : messages.submitCreate
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
