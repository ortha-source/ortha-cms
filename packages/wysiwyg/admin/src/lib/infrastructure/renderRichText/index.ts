/**
 * Turns a stored rich-text value into the HTML the **preview** renders.
 *
 * This is not a formatting pass — it is the plugin's trust boundary. A
 * `richtext` value is whatever some other CMS user typed (or pasted, or wrote
 * straight through the API), and a preview renders it as markup rather than
 * text. Handing that string to `dangerouslySetInnerHTML` unchecked would make
 * every rich-text field a stored-XSS vector against anyone who opens the record
 * — `<img src=x onerror=…>` runs on `innerHTML` even though `<script>` doesn't,
 * and a contributor could aim it at an admin.
 *
 * So the value is round-tripped through the editor's own ProseMirror schema:
 * parsed out of an **inert** document (a `DOMParser` document loads no
 * resources and runs no scripts), then re-serialized from the parsed nodes.
 * Only what the schema declares survives — every node, mark, and attribute the
 * editor can't produce is dropped, event handlers included, and the Link
 * extension blanks any href outside its protocol allowlist (`javascript:`).
 * That makes the allowlist the *same* definition as "what this editor can
 * write", so the preview is exactly what the author would see with the dialog
 * open. A hand-kept tag list would be a second definition, free to drift.
 *
 * The one intentional difference from the editor: links are flattened to spans.
 * A preview sits under a full-bleed "edit" button, and a live `<a>` inside it
 * would be a tab stop that navigates the admin away from the record — so the
 * output is left with **no focusable elements at all**, which is what makes
 * that button safe to overlay.
 */

import { getSchema } from '@tiptap/core';
import {
    DOMParser as ProseMirrorDOMParser,
    DOMSerializer,
    type Schema
} from '@tiptap/pm/model';
import { editorExtensions } from '../editorExtensions';

/**
 * The schema, built once. It depends only on the nodes and marks in the
 * extension list — never on the per-field placeholder — so every field can
 * share it instead of paying for a schema build per render.
 */
let cached: Schema | null = null;

function schema(): Schema {
    if (!cached) cached = getSchema(editorExtensions(''));
    return cached;
}

/**
 * The sanitized HTML for a rich-text value, ready for `innerHTML`. Returns `''`
 * for a non-string, so a caller can treat "nothing to render" uniformly.
 */
export function renderRichText(value: unknown): string {
    if (typeof value !== 'string' || value === '') return '';

    // Inert: this document is parsed, never loaded — no network, no scripts,
    // no `onerror` — which is what makes it safe to touch the input at all.
    const inert = new window.DOMParser().parseFromString(value, 'text/html');
    const doc = ProseMirrorDOMParser.fromSchema(schema()).parse(inert.body);

    const target = document.createElement('div');
    target.appendChild(
        DOMSerializer.fromSchema(schema()).serializeFragment(doc.content, {
            document
        })
    );
    flattenLinks(target);
    return target.innerHTML;
}

/**
 * Replaces every `<a>` with a `<span data-link>` holding the same children.
 * The styling follows the attribute, so a link still *looks* like one; it just
 * stops being a tab stop the reader can fall into on their way to the edit
 * button.
 */
function flattenLinks(root: HTMLElement): void {
    root.querySelectorAll('a').forEach((anchor) => {
        const span = document.createElement('span');
        span.setAttribute('data-link', '');
        while (anchor.firstChild) span.appendChild(anchor.firstChild);
        anchor.replaceWith(span);
    });
}
