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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner
} from '@orthacms/design-system';
import type {
    SegmentCardinality,
    SegmentType
} from '../../../domain/types/segmentType';

const messages = defineMessages({
    createTitle: {
        id: 'segments.typeDialog.createTitle',
        defaultMessage: 'New segment type'
    },
    createBody: {
        id: 'segments.typeDialog.createBody',
        defaultMessage:
            'An axis reader access is decided on — organisation, plan, region. Types are combined with AND, so a reader must satisfy every one of them.'
    },
    editTitle: {
        id: 'segments.typeDialog.editTitle',
        defaultMessage: 'Rename segment type'
    },
    editBody: {
        id: 'segments.typeDialog.editBody',
        defaultMessage:
            'The namespace and the projection slot are fixed — they are what every projected row means.'
    },
    label: { id: 'segments.typeDialog.label', defaultMessage: 'Name' },
    labelHint: {
        id: 'segments.typeDialog.labelHint',
        defaultMessage: 'Shown in the entry editor and the rule builder.'
    },
    key: { id: 'segments.typeDialog.key', defaultMessage: 'Tag namespace' },
    keyHint: {
        id: 'segments.typeDialog.keyHint',
        defaultMessage:
            'The half before the colon in a reader tag. “{key}” makes “{key}:acme”. Lowercase, and permanent.'
    },
    cardinality: {
        id: 'segments.typeDialog.cardinality',
        defaultMessage: 'How segments are picked'
    },
    cardinalityHint: {
        id: 'segments.typeDialog.cardinalityHint',
        defaultMessage:
            'A rendering hint only — it changes no decision, just whether the editor gets checkboxes or a search box.'
    },
    low: {
        id: 'segments.typeDialog.low',
        defaultMessage: 'A handful — show them all'
    },
    high: {
        id: 'segments.typeDialog.high',
        defaultMessage: 'Many — search for them'
    },
    submitCreate: {
        id: 'segments.typeDialog.submitCreate',
        defaultMessage: 'Create type'
    },
    submitEdit: {
        id: 'segments.typeDialog.submitEdit',
        defaultMessage: 'Save'
    },
    cancel: { id: 'segments.typeDialog.cancel', defaultMessage: 'Cancel' }
});

/** What the dialog submits. `key` is absent when editing — it is immutable. */
export type SegmentTypeDraft = {
    key: string;
    label: string;
    cardinality: SegmentCardinality;
};

/** Props for {@link SegmentTypeDialog}. */
type SegmentTypeDialogProps = {
    /** Whether the dialog is shown. */
    open: boolean;
    /** Opens/closes it. */
    onOpenChange: (open: boolean) => void;
    /** The type being renamed, or `null` to create a new one. */
    editing: SegmentType | null;
    /** Submits the draft. */
    onSubmit: (draft: SegmentTypeDraft) => void;
    /** Whether the write is in flight. */
    submitting: boolean;
};

/**
 * Create or rename a segment type.
 *
 * One dialog for both, because they differ in exactly one field: the namespace
 * is derived from the name while creating and **not shown at all** while
 * editing. It is not merely disabled — a greyed-out field invites the question
 * "why can't I change this", and the answer (every projected row is keyed by
 * the slot that namespace claimed) does not fit in a tooltip.
 */
export function SegmentTypeDialog({
    open,
    onOpenChange,
    editing,
    onSubmit,
    submitting
}: SegmentTypeDialogProps) {
    const intl = useIntl();
    const [label, setLabel] = useState('');
    const [key, setKey] = useState('');
    const [keyTouched, setKeyTouched] = useState(false);
    const [cardinality, setCardinality] = useState<SegmentCardinality>('low');

    // Reset on every open so a cancelled draft never bleeds into the next one,
    // and so opening the dialog on a different type shows that type.
    useEffect(() => {
        if (!open) return;
        setLabel(editing?.label ?? '');
        setKey(editing?.key ?? '');
        setKeyTouched(false);
        setCardinality(editing?.cardinality ?? 'low');
    }, [open, editing]);

    // The namespace tracks the name until the administrator takes it over —
    // the same convention the workspace slug follows, and it is right here for
    // the same reason: the derived value is correct almost always, and the
    // moment it isn't, typing in the field is what says so.
    const derivedKey = keyTouched ? key : slugify(label).replace(/-/g, '_');
    const valid =
        label.trim().length > 0 && (editing ? true : derivedKey.length > 0);

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
                    id="segment-type-form"
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!valid || submitting) return;
                        onSubmit({
                            key: derivedKey,
                            label: label.trim(),
                            cardinality
                        });
                    }}
                >
                    <Field>
                        <FieldLabel htmlFor="segment-type-label">
                            {intl.formatMessage(messages.label)}
                        </FieldLabel>
                        <Input
                            id="segment-type-label"
                            value={label}
                            autoFocus
                            onChange={(event) => setLabel(event.target.value)}
                        />
                        <FieldDescription>
                            {intl.formatMessage(messages.labelHint)}
                        </FieldDescription>
                    </Field>

                    {editing ? null : (
                        <Field>
                            <FieldLabel htmlFor="segment-type-key">
                                {intl.formatMessage(messages.key)}
                            </FieldLabel>
                            <Input
                                id="segment-type-key"
                                value={derivedKey}
                                onChange={(event) => {
                                    setKeyTouched(true);
                                    setKey(event.target.value);
                                }}
                            />
                            <FieldDescription>
                                {intl.formatMessage(messages.keyHint, {
                                    key: derivedKey || 'org'
                                })}
                            </FieldDescription>
                        </Field>
                    )}

                    <Field>
                        <FieldLabel htmlFor="segment-type-cardinality">
                            {intl.formatMessage(messages.cardinality)}
                        </FieldLabel>
                        <Select
                            value={cardinality}
                            onValueChange={(value) =>
                                setCardinality(value as SegmentCardinality)
                            }
                        >
                            <SelectTrigger id="segment-type-cardinality">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">
                                    {intl.formatMessage(messages.low)}
                                </SelectItem>
                                <SelectItem value="high">
                                    {intl.formatMessage(messages.high)}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <FieldDescription>
                            {intl.formatMessage(messages.cardinalityHint)}
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
                        form="segment-type-form"
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
