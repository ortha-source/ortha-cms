import { useMemo } from 'react';
import { sanitizeHtml } from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { WYSIWYG_PROSE } from '../wysiwygProse';

/**
 * Renders a stored wysiwyg value as **read-only** HTML — the preview card, and
 * anywhere else the admin needs to show a document without editing it.
 *
 * It sanitizes on the way in, every time. The value has already been
 * canonicalized by the server on write, so this is redundant on the happy path
 * — which is the point: `dangerouslySetInnerHTML` is only defensible when the
 * string reaching it cannot be anything but safe, and "the server already did
 * it" is an assumption about a different process.
 */
export function WysiwygContent({
    html,
    className
}: {
    html: string;
    className?: string;
}) {
    const safe = useMemo(() => sanitizeHtml(html ?? ''), [html]);
    return (
        <div
            className={cn(WYSIWYG_PROSE, className)}
            dangerouslySetInnerHTML={{ __html: safe }}
        />
    );
}
