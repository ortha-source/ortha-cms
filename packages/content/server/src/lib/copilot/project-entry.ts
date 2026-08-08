import type { EntryRecord } from '../entries/types/entry-list-view';

/**
 * Narrows an entry's `values` to the named fields, leaving the envelope alone.
 *
 * **This is what makes "list all the articles" possible at all.** A full
 * `EntryRecord` carries every field including richtext bodies, so a page of 25
 * can be tens of thousands of tokens — the run hits its token ceiling long
 * before it hits the row cap. Asking for `["text","status"]` turns the same page
 * into something a model can actually reason over.
 *
 * The envelope (`id`, `status`, `locale`, timestamps, …) is always kept: `id` is
 * what makes an entry addressable for a follow-up `content.getEntry`, and a
 * projection that could drop it would be a trap. Same rule the public API's
 * sparse fieldsets follow.
 *
 * An unknown name is **ignored** rather than rejected. The public API 400s one,
 * because there a typo is a developer's bug worth surfacing; here the names come
 * from a model that may have mis-remembered a field, and failing the whole call
 * over one bad name costs a round trip to learn something the response itself
 * shows. The returned `values` say what was actually found.
 */
export function projectEntry(
    entry: EntryRecord,
    fields: readonly string[] | undefined
): EntryRecord {
    if (!fields || fields.length === 0) {
        return entry;
    }
    const wanted = new Set(fields);
    const values: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry.values ?? {})) {
        if (wanted.has(key)) {
            values[key] = value;
        }
    }
    return { ...entry, values };
}
