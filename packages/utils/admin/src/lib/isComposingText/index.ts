/**
 * Whether `target` is somewhere the user is composing text — a form field, or
 * any `contenteditable` host (the rich-text body).
 *
 * Global keyboard shortcuts are bound on `window`, so they fire wherever focus
 * is. Firing one out from under a caret is a change of context in response to
 * input into a *different* control (WCAG 3.2.2), and the `preventDefault()` that
 * usually comes with it destroys the keystroke the user actually meant. Where
 * the chord is one an editor owns — ⌘B is **bold** in a rich-text body — it is
 * worse than a change of context: the author gets both.
 *
 * This lived as three separate copies (`shell-admin`'s ⌘K, `content-admin`'s
 * content palette, and the design system's own ⌘B guard), while the copilot's ⌘J
 * had none at all and opened a chat from inside the editor (`ORT-163`). One
 * implementation, so a new global chord has something to call.
 *
 * Typed structurally rather than against `Element`: these packages compile with
 * the DOM lib, but a `keydown` target can be something that is not an element at
 * all (`window`, a text node), and a `closest` that is not there is not a
 * composition context.
 */
export function isComposingText(target: EventTarget | null): boolean {
    const element = target as {
        closest?: (selector: string) => unknown;
    } | null;
    if (!element || typeof element.closest !== 'function') return false;
    return Boolean(
        element.closest(
            'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
        )
    );
}
