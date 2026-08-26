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
        defaultMessage: 'Permanent, and the default reader tag.'
    },
    tags: { id: 'segments.dialog.tags', defaultMessage: 'Reader tags' },
    tagsHint: {
        id: 'segments.dialog.tagsHint',
        defaultMessage:
            'One per line — the identifiers your readers arrive with. Any one is enough to match. Leave empty to use just “{key}”.'
    },
    submitCreate: {
        id: 'segments.dialog.submitCreate',
        defaultMessage: 'Create'
    },
    submitEdit: { id: 'segments.dialog.submitEdit', defaultMessage: 'Save' },
    cancel: { id: 'segments.dialog.cancel', defaultMessage: 'Cancel' }
});

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
    onSubmit: (draft: SegmentDraft) => void;
    submitting: boolean;
};

/**
 * Create or edit an audience.
 *
 * The **tags** field is a textarea of one per line rather than a chip input,
 * because the common case is pasting a list out of the system that owns the
 * identifiers — and a chip editor turns a paste of forty plan codes into forty
 * interactions.
 *
 * The key is shown only while creating. It is not merely disabled when editing:
 * a greyed-out field invites "why can't I change this", and the answer — every
 * entry that named this segment holds its id, and the key is what a reader tag
 * defaults to — does not fit in a tooltip.
 */
export function SegmentDialog({
    open,
    onOpenChange,
    editing,
    onSubmit,
    submitting
}: SegmentDialogProps) {
    const intl = useIntl();
    const [label, setLabel] = useState('');
    const [key, setKey] = useState('');
    const [keyTouched, setKeyTouched] = useState(false);
    const [tags, setTags] = useState('');

    // Reset on every open, so a cancelled draft never bleeds into the next one.
    useEffect(() => {
        if (!open) return;
        setLabel(editing?.label ?? '');
        setKey(editing?.key ?? '');
        setKeyTouched(false);
        setTags(editing ? editing.tags.join('\n') : '');
    }, [open, editing]);

    // The key tracks the name until somebody takes it over — the same
    // convention the workspace slug follows, and right here for the same
    // reason: the derived value is correct almost always, and typing in the
    // field is what says it isn't.
    const derivedKey = keyTouched ? key : slugify(label);
    const valid = label.trim().length > 0 && (editing || derivedKey.length > 0);

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
                                {intl.formatMessage(messages.keyHint)}
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
                            placeholder={derivedKey || 'acme'}
                            onChange={(event) => setTags(event.target.value)}
                        />
                        <FieldDescription>
                            {intl.formatMessage(messages.tagsHint, {
                                key: derivedKey || 'acme'
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
