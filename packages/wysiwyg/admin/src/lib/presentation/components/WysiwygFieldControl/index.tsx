import { defineMessages, useIntl } from 'react-intl';
import { Pencil } from 'lucide-react';
import { cn } from '@ortha-cms/design-system';
import type { EntryFieldControlContext } from '@ortha-cms/content-admin';
import { isEmptyRichText } from '../../../domain/richTextValue';
import { WysiwygPreview } from '../WysiwygPreview';

const messages = defineMessages({
    edit: {
        id: 'wysiwyg.field.edit',
        defaultMessage: 'Edit {label}'
    },
    editChip: {
        id: 'wysiwyg.field.editChip',
        defaultMessage: 'Edit'
    },
    empty: {
        id: 'wysiwyg.field.empty',
        defaultMessage: 'Nothing written yet — press Edit to start.'
    }
});

/** How tall the collapsed preview grows before it fades out. */
const PREVIEW_CLAMP = 'max-h-72';

/**
 * A `richtext` field, in the entry form: what's been written, shown as it will
 * read, opening into the full editor when pressed.
 *
 * The preview is the control's whole point. A rich-text body rendered into a
 * `<textarea>` is a wall of tags nobody can proofread, so the field shows the
 * *content* and keeps the authoring surface behind a deliberate press.
 *
 * Pressing it **expands the field into the work area** (`WysiwygFieldFullView`)
 * rather than opening a dialog over the form — so the record, its Save action,
 * and the Properties rail all stay where they were. The control owns none of
 * that: it asks, `EntryEditor` swaps the view.
 *
 * ### Why the button overlays the preview instead of wrapping it
 *
 * Wrapping formatted content in a `<button>` puts headings, lists, and tables
 * inside a control — invalid, and it flattens the whole body into the button's
 * accessible name. Instead the preview renders as ordinary content and a
 * transparent button is laid over it, so the two are siblings: assistive tech
 * reads the content, then offers one clearly-named action, and a pointer
 * anywhere on the card still opens the editor. That only holds because
 * `renderRichText` leaves no focusable elements in the preview — otherwise the
 * links underneath would be tab stops hidden beneath a button.
 */
export function WysiwygFieldControl({
    field,
    id,
    label,
    value,
    error,
    describedBy,
    setExpanded
}: EntryFieldControlContext) {
    const intl = useIntl();
    const placeholder = field.admin['placeholder'];
    const empty = isEmptyRichText(value);

    return (
        <div
            className={cn(
                'relative rounded-lg border border-input bg-card',
                // The ring follows the overlay button, so the card reads as
                // one focusable control rather than the button reading as a
                // second thing floating on top of it.
                'has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring/40',
                error && 'border-destructive'
            )}
        >
            {empty ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                    {typeof placeholder === 'string' && placeholder !== ''
                        ? placeholder
                        : intl.formatMessage(messages.empty)}
                </p>
            ) : (
                <div
                    className={cn(
                        'relative overflow-hidden px-4 py-3',
                        PREVIEW_CLAMP
                    )}
                >
                    <WysiwygPreview value={value} />
                    {/* Fades the clipped edge, so a body longer than the
                            clamp reads as continuing rather than as ending
                            mid-sentence. */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent"
                    />
                </div>
            )}

            {/* The name is an `aria-label`, not `sr-only` text: this button
                    carries the field's `id`, so content-admin's `<label for>`
                    points at it — and a native label outranks a button's own
                    contents, which left it announcing "Body" with no hint that
                    pressing it opens anything. `aria-label` outranks the label
                    in turn, and still contains the visible label text, so the
                    name matches what a speech-input user would say (2.5.3).

                    No `aria-invalid`/`aria-required`: neither applies to a
                    button, and ARIA has no invalid state for one. The error
                    reaches assistive tech the way it can — `aria-describedby`
                    points at the message content-admin renders below, so it is
                    announced on focus and not only when it appears. The red
                    border above carries the same thing visually.

                    No `aria-haspopup` either: pressing this navigates the work
                    area to the editor, it does not open a popup over it. */}
            <button
                id={id}
                type="button"
                className="absolute inset-0 rounded-lg focus-visible:outline-none"
                aria-label={intl.formatMessage(messages.edit, { label })}
                aria-describedby={describedBy}
                onClick={() => setExpanded(true)}
            />

            <span
                aria-hidden
                className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-muted-foreground"
            >
                <Pencil className="size-3" />
                {intl.formatMessage(messages.editChip)}
            </span>
        </div>
    );
}
