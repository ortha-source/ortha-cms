/**
 * The **canonicalization** pass: HTML in, HTML out, guaranteed to be the exact
 * markup this package would have produced for that content.
 *
 * It is a full round trip (parse → sanitize → interpret as blocks → serialize),
 * which buys three things a plain sanitize pass doesn't:
 *
 * - **Safety** — the same allow-list, applied where it can't be skipped.
 * - **Stability** — two authors writing the same content through different
 *   paths (the editor, an import, an API client) store byte-identical HTML, so
 *   revision diffs show real edits instead of formatting noise.
 * - **Truthfulness** — markup that doesn't correspond to any block type is
 *   reduced to what does, so what is stored is what the editor can show.
 *
 * This is what the **server** runs on write. The admin sanitizes too, but the
 * admin is a client: the value that reaches the column has to be cleaned by
 * something an API caller can't bypass.
 */

import { isEmptyHtml } from '../text/plain-text';
import { parseDocument, type ParseOptions } from './parse-document';
import { serializeDocument } from './serialize';

/**
 * Canonical HTML for `html`. A value with no content at all normalizes to the
 * empty string rather than to `<p></p>` — "empty" has to survive the round trip
 * or every untouched field would read as filled in, and a `required` rule would
 * pass on a blank one.
 */
export function normalizeWysiwygHtml(
    html: string | null | undefined,
    options: ParseOptions = {}
): string {
    if (isEmptyHtml(html)) return '';
    return serializeDocument(parseDocument(html ?? '', options), options);
}
