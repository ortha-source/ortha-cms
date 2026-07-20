/**
 * The **publish gate** — the predicate "are this entry's field values complete
 * and valid enough to publish", derived from the same {@link validateEntryValues}
 * rules. A publishable type defers validation until publish (a draft may be
 * saved incomplete), so this is what the server re-checks against the stored
 * row before flipping `status` to `published`, and what the admin's editor
 * mirrors to enable/disable its Publish button.
 *
 * Scope note: this covers the **values bag** only. A required **link-managed**
 * relation (an owning many-to-many, or the inverse of one) can't be judged here
 * — its links never travel in `values` — so `content-server` additionally
 * enforces those by counting links in its persistence layer. The gate and that
 * link check together form the full server-side publish precondition.
 */

import type { EntryFieldSpecMap } from '../fields/field-spec';
import { validateEntryValues } from './validate-entry-values';

/**
 * Whether `values` satisfies the publish gate for the given field schema — i.e.
 * every required field is present and every present value is valid. Equivalent
 * to `validateEntryValues(fields, values).valid`; exposed as a named predicate
 * because "can this publish?" is the question both runtimes ask.
 */
export function canPublish(
    fields: EntryFieldSpecMap,
    values: Record<string, unknown>
): boolean {
    return validateEntryValues(fields, values).valid;
}
