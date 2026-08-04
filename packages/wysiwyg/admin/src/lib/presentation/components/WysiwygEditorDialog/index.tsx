import { defineMessages, useIntl } from 'react-intl';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@ortha-cms/design-system';
import { WysiwygEditorPanel } from './WysiwygEditorPanel';

const messages = defineMessages({
    description: {
        id: 'wysiwyg.dialog.description',
        defaultMessage:
            'Changes are kept as you type — save the record to publish them.'
    }
});

/**
 * The full-size editing surface a rich-text field opens into.
 *
 * A dialog rather than an inline editor because the controls this field needs —
 * tables, columns, callouts, two color pickers — do not fit beside the one-line
 * inputs of the rest of the form, and a toolbar that wraps to four rows makes
 * every *other* field harder to fill in.
 *
 * Radix's own open-focus is suppressed so focus lands in the document instead
 * of on the ✕: the author opened this to write. The dialog still traps focus,
 * because the editor takes it immediately (`autofocus: 'end'`).
 */
export function WysiwygEditorDialog({
    open,
    onOpenChange,
    fieldLabel,
    initialHtml,
    placeholder,
    onChange
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The field's display label — the dialog's title. */
    fieldLabel: string;
    /** The value at open time; the panel reads it once, at mount. */
    initialHtml: string;
    /** The field's `admin.placeholder`, shown in an empty document. */
    placeholder: string;
    /** Write an edit back to the entry form. */
    onChange: (value: string) => void;
}) {
    const intl = useIntl();
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex h-[85vh] w-[min(96vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0"
                onOpenAutoFocus={(event) => event.preventDefault()}
            >
                {/* `pr-14` clears the ✕ Dialog pins to the top-right corner. */}
                <DialogHeader className="border-b border-border px-6 py-4 pr-14">
                    <DialogTitle>{fieldLabel}</DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>
                <WysiwygEditorPanel
                    fieldLabel={fieldLabel}
                    initialHtml={initialHtml}
                    placeholder={placeholder}
                    onChange={onChange}
                    onDone={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}
