import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { slugify } from '@orthacms/utils-admin';
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
    FieldLabel,
    Input,
    Spinner,
    Textarea
} from '@orthacms/design-system';
import type { Segment } from '../../../domain/types/segment';
import type { SegmentType } from '../../../domain/types/segmentType';

const messages = defineMessages({
    createTitle: {
        id: 'segments.segmentDialog.createTitle',
        defaultMessage: 'New segment in {type}'
    },
    createBody: {
        id: 'segments.segmentDialog.createBody',
        defaultMessage:
            'A named set of reader tags. Rules and grants point at the segment, never at a tag — which is what makes renaming an upstream identifier one edit here instead of a migration.'
    },
    editTitle: {
        id: 'segments.segmentDialog.editTitle',
        defaultMessage: 'Edit segment'
    },
    editBody: {
        id: 'segments.segmentDialog.editBody',
        defaultMessage:
            'Changing the tags changes who this segment matches, immediately, everywhere it is used.'
    },
    label: { id: 'segments.segmentDialog.label', defaultMessage: 'Name' },
    key: { id: 'segments.segmentDialog.key', defaultMessage: 'Key' },
    keyHint: {
        id: 'segments.segmentDialog.keyHint',
        defaultMessage: 'Within {type}. Becomes the tag “{tag}”. Permanent.'
    },
    tags: {
        id: 'segments.segmentDialog.tags',
        defaultMessage: 'Reader tags'
    },
    tagsHint: {
        id: 'segments.segmentDialog.tagsHint',
        defaultMessage:
            'One per line. Any one of them is enough to match. Leave empty to use just “{tag}” — add more when the same audience arrives under a second, legacy identifier.'
    },
    submitCreate: {
        id: 'segments.segmentDialog.submitCreate',
        defaultMessage: 'Create segment'
    },
    submitEdit: {
        id: 'segments.segmentDialog.submitEdit',
        defaultMessage: 'Save'
    },
    cancel: { id: 'segments.segmentDialog.cancel', defaultMessage: 'Cancel' }
});

/** What the dialog submits. */
export type SegmentDraft = {
    key: string;
    label: string;
    tags: string[];
};

/** Props for {@link SegmentDialog}. */
type SegmentDialogProps = {
    /** Whether the dialog is shown. */
    open: boolean;
    /** Opens/closes it. */
    onOpenChange: (open: boolean) => void;
    /** The type the segment belongs to. */
    type: SegmentType;
    /** The segment being edited, or `null` to create one. */
    editing: Segment | null;
    /** Submits the draft. */
    onSubmit: (draft: SegmentDraft) => void;
    /** Whether the write is in flight. */
    submitting: boolean;
};

/**
 * Create or edit a segment.
 *
 * The **tags** field is a textarea of one tag per line rather than a chip input,
 * and that is deliberate: the common case is pasting a list out of the system
 * that owns the identifiers. A chip editor turns a paste of forty plan codes
 * into forty interactions.
 *
 * A mask segment never reaches this dialog — it matches its whole namespace and
 * carries no tags of its own, so the directory offers it no edit control.
 */
export function SegmentDialog({
    open,
    onOpenChange,
    type,
    editing,
    onSubmit,
    submitting
}: SegmentDialogProps) {
    const intl = useIntl();
    const [label, setLabel] = useState('');
    const [key, setKey] = useState('');
    const [keyTouched, setKeyTouched] = useState(false);
    const [tags, setTags] = useState('');

    useEffect(() => {
        if (!open) return;
        setLabel(editing?.label ?? '');
        setKey(editing?.key ?? '');
        setKeyTouched(false);
        setTags(editing ? editing.tags.join('\n') : '');
    }, [open, editing]);

    const derivedKey = keyTouched ? key : slugify(label);
    const canonicalTag = `${type.key}:${derivedKey || 'acme'}`;
    const valid = label.trim().length > 0 && (editing || derivedKey.length > 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {editing
                            ? intl.formatMessage(messages.editTitle)
                            : intl.formatMessage(messages.createTitle, {
                                  type: type.label
                              })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(
                            editing ? messages.editBody : messages.createBody
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="segment-form"
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!valid || submitting) return;
                        onSubmit({
                            key: derivedKey,
                            label: label.trim(),
                            tags: tags
                                .split('\n')
                                .map((tag) => tag.trim())
                                .filter(Boolean)
                        });
                    }}
                >
                    <Field>
                        <FieldLabel htmlFor="segment-label">
                            {intl.formatMessage(messages.label)}
                        </FieldLabel>
                        <Input
                            id="segment-label"
                            value={label}
                            autoFocus
                            onChange={(event) => setLabel(event.target.value)}
                        />
                    </Field>

                    {editing ? null : (
                        <Field>
                            <FieldLabel htmlFor="segment-key">
                                {intl.formatMessage(messages.key)}
                            </FieldLabel>
                            <Input
                                id="segment-key"
                                value={derivedKey}
                                onChange={(event) => {
                                    setKeyTouched(true);
                                    setKey(event.target.value);
                                }}
                            />
                            <FieldDescription>
                                {intl.formatMessage(messages.keyHint, {
                                    type: type.label,
                                    tag: canonicalTag
                                })}
                            </FieldDescription>
                        </Field>
                    )}

                    <Field>
                        <FieldLabel htmlFor="segment-tags">
                            {intl.formatMessage(messages.tags)}
                        </FieldLabel>
                        <Textarea
                            id="segment-tags"
                            rows={4}
                            value={tags}
                            placeholder={canonicalTag}
                            onChange={(event) => setTags(event.target.value)}
                        />
                        <FieldDescription>
                            {intl.formatMessage(messages.tagsHint, {
                                tag: canonicalTag
                            })}
                        </FieldDescription>
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
                    <Button
                        type="submit"
                        form="segment-form"
                        disabled={!valid || submitting}
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
