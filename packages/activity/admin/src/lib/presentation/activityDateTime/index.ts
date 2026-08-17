/**
 * The machine-readable value for a `<time datetime="…">` attribute, or
 * `undefined` when the event's timestamp is not a real instant.
 *
 * `toActivityEvent` builds `at` with `new Date(dto.at)` and deliberately does
 * **not** substitute a fallback instant — inventing a timestamp for an audit row
 * would be the "mapper fallback that silently rewrites data" the admin-plugin
 * skill warns about, and an audit log is the last place to do it. The cost of
 * that (correct) choice is that `at` may be an `Invalid Date`, and
 * `Date.prototype.toISOString` **throws a `RangeError`** on one. Calling it
 * unguarded in render is what took the whole admin SPA down to a blank page when
 * a single malformed `at` reached the home dashboard's Recent activity panel
 * (`BUG-activity-admin-04`) — React unmounted the tree, and there is no error
 * boundary above the home slots.
 *
 * So the guard lives here, once, and every `<time>` in the plugin goes through
 * it: a bad instant costs you the `datetime` attribute on one row, not the app.
 */
export function activityDateTime(at: Date): string | undefined {
    return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
}
