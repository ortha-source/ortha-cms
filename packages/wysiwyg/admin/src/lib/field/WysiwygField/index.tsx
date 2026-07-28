import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle
} from '@ortha-cms/design-system';
import { WysiwygEditor, type WysiwygEditorProps } from '../../editor/WysiwygEditor';
import { WysiwygPreviewCard } from '../WysiwygPreviewCard';

const messages = defineMessages({
    dialogDescription: {
        id: 'wysiwyg.field.dialogDescription',
        defaultMessage:
            'Full-page editor. Type “/” for blocks; press Escape to close.'
    },
    close: {
        id: 'wysiwyg.field.close',
        defaultMessage: 'Close the editor'
    }
});

/** Props of the collapsed field control. */
export interface WysiwygFieldProps
    extends Omit<WysiwygEditorProps, 'className'> {
    /** The field's label — the dialog's heading and the preview's fallback title. */
    label: string;
}

/**
 * The wysiwyg **form control**: a preview of the document that opens the full
 * editor when pressed.
 *
 * Two surfaces, one value. Inside a form a long document has to justify every
 * pixel it takes, so the field shows what is written and how much of it; the
 * writing itself happens on a page-sized surface where the block gutter, the
 * slash menu and a comfortable measure all have room. Edits commit **live** to
 * the same `onChange` — closing the dialog is not a save, and the form's own
 * Save remains the only commit point, exactly as for every other field.
 */
export function WysiwygField({
    label,
    value,
    onChange,
    onBlur,
    readOnly = false,
    invalid = false,
    id,
    'aria-describedby': describedBy,
    ...editorProps
}: WysiwygFieldProps) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);

    return (
        <>
            <WysiwygPreviewCard
                id={id}
                html={value}
                label={label}
                readOnly={readOnly}
                invalid={invalid}
                describedBy={describedBy}
                onOpen={() => setOpen(true)}
            />
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    // Closing the editor is when the author is done with the
                    // field, which is what a form means by "touched".
                    if (!next) onBlur?.();
                }}
            >
                <DialogContent
                    // Full-bleed, and deliberately **`transform-none`**: the
                    // stock dialog centres itself with a translate, and a
                    // transformed ancestor becomes the containing block for
                    // `position: fixed` — which would leave the slash menu and
                    // the format toolbar positioning against the dialog box
                    // instead of the viewport they measured against.
                    className="inset-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 transform-none flex-col gap-0 rounded-none p-0 sm:rounded-none"
                >
                    <div className="flex items-center gap-3 border-b px-6 py-3">
                        <DialogTitle className="text-base font-semibold">
                            {label}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            {intl.formatMessage(messages.dialogDescription)}
                        </DialogDescription>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <div className="mx-auto max-w-3xl px-6 py-10">
                            <WysiwygEditor
                                {...editorProps}
                                value={value}
                                onChange={onChange}
                                readOnly={readOnly}
                                invalid={invalid}
                                // The page *is* the editor here — a border
                                // around a full-screen writing surface only
                                // draws a box around the whole window.
                                className="border-none bg-transparent"
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
