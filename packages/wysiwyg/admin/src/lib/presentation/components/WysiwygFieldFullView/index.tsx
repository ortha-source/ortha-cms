import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@ortha-cms/design-system';
import type { EntryFieldControlContext } from '@ortha-cms/content-admin';
import { asRichTextHtml } from '../../../domain/richTextValue';
import { WysiwygEditorPanel } from '../WysiwygEditorPanel';

const messages = defineMessages({
    back: {
        id: 'wysiwyg.fullView.back',
        defaultMessage: 'Back to fields'
    },
    required: {
        id: 'wysiwyg.fullView.required',
        defaultMessage: 'Required'
    }
});

/**
 * The rich-text editor as a **view**, filling the entry editor's work area.
 *
 * Rendered by content-admin in place of the tab strip once the field is
 * expanded (`ENTRY_FIELD_CONTROL_SLOT`'s `FullView`), which is what keeps
 * everything around it alive: the app sidebar, the record's title, the top
 * bar's Save / Publish, and the Properties rail — whose publish gate ticks over
 * live as the body is written, because this is still the record's own form.
 *
 * A dialog could do none of that. It would cover the rail it should be
 * updating, hide the record it belongs to, and put Save behind an overlay.
 *
 * Leaving is explicit — **Back to fields** above, **Done** in the footer — and
 * both are safe, because edits are already in the form by the time either is
 * pressed. There is deliberately no Escape shortcut: the toolbar's menus and
 * popovers each answer Escape themselves, and a second handler on the view
 * would race them into closing the whole editor out from under an open menu.
 */
export function WysiwygFieldFullView({
    field,
    label,
    value,
    error,
    onChange,
    onBlur,
    setExpanded
}: EntryFieldControlContext) {
    const intl = useIntl();
    const headingId = useId();
    const errorId = useId();
    const placeholder = field.admin['placeholder'];

    // Collapsing is when the author is done with this field, which is what
    // `touch` means to the form — the point a required field may complain.
    const collapse = () => {
        setExpanded(false);
        onBlur?.();
    };

    return (
        <section
            aria-labelledby={headingId}
            className="flex min-h-0 flex-1 flex-col"
        >
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-7 gap-1.5 px-2 text-muted-foreground"
                    onClick={collapse}
                >
                    <ArrowLeft />
                    {intl.formatMessage(messages.back)}
                </Button>
                <h2
                    id={headingId}
                    className="text-sm font-medium tracking-[-0.01em]"
                >
                    {label}
                </h2>
                {field.required ? (
                    <span className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.required)}
                    </span>
                ) : null}
            </div>

            {/* The field's `<FieldError>` lives on the form row, which is not on
                screen while this view is — so the error is surfaced here, or it
                would be surfaced nowhere. */}
            {error ? (
                <p
                    id={errorId}
                    role="alert"
                    className="mb-3 text-sm text-destructive"
                >
                    {error}
                </p>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-input bg-card">
                <WysiwygEditorPanel
                    fieldLabel={label}
                    initialHtml={asRichTextHtml(value)}
                    placeholder={
                        typeof placeholder === 'string' ? placeholder : ''
                    }
                    required={field.required}
                    onChange={onChange}
                    onDone={collapse}
                />
            </div>
        </section>
    );
}
