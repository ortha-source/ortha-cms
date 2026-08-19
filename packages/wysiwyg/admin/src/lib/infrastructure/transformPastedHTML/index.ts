/**
 * The inline style properties a paste is not allowed to bring with it.
 *
 * `color` and `font-size` are `textStyle` mark attributes, so `TextStyle` +
 * `Color` + `FontSize` parse them straight out of pasted markup and into the
 * stored body. `background-color` rides in the same way through `Highlight`.
 */
const STRIPPED_PROPERTIES = ['color', 'font-size', 'background-color'];

/**
 * Drops the source application's typography from pasted HTML.
 *
 * `packages/wysiwyg/admin/AGENTS.md` justifies keeping inline colour: "Colors
 * the author picked (text color, highlight) are inline on the content and stay
 * put — those are content, not chrome." That is right for a colour chosen from
 * the toolbar's swatch. **A paste is not a choice**: nobody opened the colour
 * menu, and the author usually cannot tell it happened.
 *
 * What actually survived a paste, measured with Word's and Google Docs' own
 * `text/html` on a live stack (`ORT-164`):
 *
 * - Word → `<span style="color: rgb(192, 0, 0); font-size: 14pt;">`
 * - Google Docs → `<span style="color: rgb(0, 0, 0); font-size: 11pt;">`, which
 *   Docs stamps on essentially every run it exports
 *
 * So a body pasted from Docs carried `color: rgb(0,0,0)` on every paragraph: a
 * site with a dark theme, or any body colour that is not pure black, silently
 * lost its own typography for that entry, and `font-size: 11pt` overrode the
 * template's scale. It is also the concrete case behind "the editor can display
 * author text at any contrast, including unreadable, with no warning" — black on
 * the admin's own dark theme is arrived at by pasting, not by choosing.
 *
 * Only the clipboard path is touched. Toolbar-applied colour goes through the
 * commands, never through here, so "author-chosen colour is content" stays true
 * — and starts actually meaning *chosen*.
 */
export function transformPastedHTML(html: string): string {
    // `DOMParser` rather than a regex over `style="…"`: the value can contain
    // quotes, `url()` commas and escaped characters, and getting that wrong on
    // paste corrupts the author's text rather than merely missing a case.
    if (typeof DOMParser === 'undefined') return html;

    const document = new DOMParser().parseFromString(html, 'text/html');
    for (const element of document.body.querySelectorAll<HTMLElement>(
        '[style]'
    )) {
        for (const property of STRIPPED_PROPERTIES) {
            element.style.removeProperty(property);
        }
        // An element whose *only* styling was the stripped set is left with an
        // empty `style=""`, which serializes as noise into the stored body.
        if (element.style.length === 0) element.removeAttribute('style');
    }
    return document.body.innerHTML;
}
