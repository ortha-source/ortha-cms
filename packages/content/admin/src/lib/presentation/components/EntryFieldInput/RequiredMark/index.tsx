/**
 * The visible "this field is required" marker in a field's label row.
 *
 * Deliberately **`aria-hidden`**: the control itself carries `aria-required`,
 * which is what a screen reader announces. Marking the asterisk up as well
 * would announce "required" twice on every required field — and this composes
 * *into* the `FieldLabel`, so any text here lands in the field's accessible
 * name rather than beside it.
 *
 * It used to carry a native `title` explaining the convention to sighted users
 * who do not know it. That was unreachable by every route at once: a `title` is
 * mouse-only (never surfaced by keyboard or touch) and is neither dismissible
 * nor hoverable, which 1.4.13 Content on Hover or Focus requires — and on an
 * `aria-hidden` element assistive tech could not reach it either (`ORT-90`).
 *
 * The explanation is a **visible legend above the fields** now
 * (`EntryFieldSections`), which is where a form-wide convention belongs: stated
 * once, in the page, for everyone, with nothing to hover.
 */
export function RequiredMark() {
    return (
        <span aria-hidden className="ml-0.5 select-none text-destructive">
            *
        </span>
    );
}
