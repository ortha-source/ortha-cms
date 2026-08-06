import { defineMessages, useIntl } from 'react-intl';
import { Eye } from 'lucide-react';

const messages = defineMessages({
    title: {
        id: 'content.editor.readOnlyTitle',
        defaultMessage: 'View only'
    },
    body: {
        id: 'content.editor.readOnlyBody',
        defaultMessage:
            'You can read this record but not change it. Ask an administrator for content editing access.'
    }
});

/**
 * The banner over a **read-only** entry editor, explaining why every field is
 * inert. Without it the form is a silent puzzle: a reader meets a page whose
 * inputs don't take typing and whose buttons are missing, with nothing on screen
 * saying it is a permission and not a fault.
 *
 * Deliberately **not** the design-system `Alert`, whose `role="alert"` is a live
 * region: this is page furniture that exists from first paint, not an event, and
 * announcing it assertively would cut across the reader's own place in the page.
 * A plain banner is read in document order, where it belongs — immediately after
 * the record's title and before the fields it describes.
 */
export function ReadOnlyNotice() {
    const intl = useIntl();

    return (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info-soft-foreground">
            <Eye className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            <p className="min-w-0">
                <span className="font-medium">
                    {intl.formatMessage(messages.title)}
                </span>{' '}
                {intl.formatMessage(messages.body)}
            </p>
        </div>
    );
}
