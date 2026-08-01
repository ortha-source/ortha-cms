import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight, PenLine } from 'lucide-react';
import { htmlToPlainText, isEmptyHtml } from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { WysiwygContent } from '../../render/WysiwygContent';

const messages = defineMessages({
    open: {
        id: 'wysiwyg.preview.open',
        defaultMessage: 'Open {title} in the full editor'
    },
    emptyTitle: {
        id: 'wysiwyg.preview.emptyTitle',
        defaultMessage: 'Nothing written yet'
    },
    emptyBody: {
        id: 'wysiwyg.preview.emptyBody',
        defaultMessage: 'Click to open the editor and start writing.'
    },
    words: {
        id: 'wysiwyg.preview.words',
        defaultMessage: '{count, plural, one {# word} other {# words}}'
    },
    readOnly: {
        id: 'wysiwyg.preview.readOnly',
        defaultMessage: 'View'
    }
});

/** How far down the miniature is legible before it stops adding information. */
const PREVIEW_HEIGHT = 'h-52';

/**
 * The collapsed form control: a **miniature of the document** over a row
 * carrying its title and size, opening the full editor when pressed.
 *
 * A long document inside a form field is a bad trade — it either dominates the
 * form or gets a scrollbar of its own, and neither leaves room to actually
 * write. Showing what is *in* there and handing the writing to a full-page
 * surface keeps both jobs honest.
 *
 * The whole card is one `<button>`: it has a single action, so it should be a
 * single tab stop with a single accessible name. The miniature inside is
 * `aria-hidden` — its text is the document's, and a screen reader hearing the
 * entire body read out as the label of a button is worse than useless.
 */
export function WysiwygPreviewCard({
    html,
    label,
    readOnly = false,
    invalid = false,
    id,
    describedBy,
    onOpen
}: {
    html: string;
    /** The field's label — the fallback title when the document has no heading. */
    label: string;
    readOnly?: boolean;
    invalid?: boolean;
    id?: string;
    describedBy?: string;
    onOpen(): void;
}) {
    const intl = useIntl();
    const empty = isEmptyHtml(html);
    const title = documentTitle(html) ?? label;
    const words = empty ? 0 : countWords(html);

    return (
        <button
            type="button"
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-label={intl.formatMessage(messages.open, { title })}
            onClick={onOpen}
            className={cn(
                'group/preview bg-background w-full overflow-hidden rounded-md border text-left',
                'hover:border-ring/60 focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none',
                invalid && 'border-destructive'
            )}
        >
            {empty ? (
                <div className="flex items-center gap-3 px-4 py-6">
                    <PenLine
                        aria-hidden
                        className="text-muted-foreground size-5 shrink-0"
                    />
                    <div>
                        <p className="text-sm font-medium">
                            {intl.formatMessage(messages.emptyTitle)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            {intl.formatMessage(messages.emptyBody)}
                        </p>
                    </div>
                </div>
            ) : (
                <div
                    aria-hidden
                    className={cn(
                        'bg-muted/20 relative overflow-hidden',
                        PREVIEW_HEIGHT
                    )}
                >
                    {/* Scaled down rather than truncated, so the shape of the
                        document — its headings, lists, callouts — is what the
                        reader recognises, not its first two sentences. */}
                    <div className="pointer-events-none w-[160%] origin-top-left scale-[0.62] px-5 pt-4">
                        <WysiwygContent html={html} />
                    </div>
                    {/* The document runs past the crop; fading it says so. */}
                    <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent" />
                </div>
            )}

            <div className="bg-background flex items-center gap-3 border-t px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {empty ? label : title}
                </span>
                <span className="text-muted-foreground shrink-0 text-sm">
                    {readOnly
                        ? intl.formatMessage(messages.readOnly)
                        : intl.formatMessage(messages.words, { count: words })}
                </span>
                <ChevronRight
                    aria-hidden
                    className="text-muted-foreground size-4 shrink-0 transition-transform group-hover/preview:translate-x-0.5"
                />
            </div>
        </button>
    );
}

/**
 * The document's own title — the text of its first heading. A post-mortem is
 * known by its heading, not by the name of the field it happens to live in, so
 * the heading wins whenever there is one.
 */
function documentTitle(html: string): string | null {
    const match = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i.exec(html ?? '');
    if (!match) return null;
    const text = htmlToPlainText(match[1]).trim();
    return text === '' ? null : text;
}

/** Words in the document — the one size measure a writer thinks in. */
function countWords(html: string): number {
    const text = htmlToPlainText(html).trim();
    return text === '' ? 0 : text.split(/\s+/).length;
}
