import { CONDITION_MODE, type AuthoredAccessRule } from './access-rule';
import { MAX_CONDITION_GROUPS } from './limits';
import type { SegmentTypeKey } from './segment-type';

/**
 * How an entry's access is expressed **before** segmentation, in the scheme
 * almost every CMS reaches for first: two relation fields on the entry, one
 * listing who may read it and one listing who may not.
 *
 * The names are the shape's, not this CMS's — an adopter's fields are called
 * `subscriptions` and `excludedSubscriptions`, or `plans` and `blockedPlans`.
 * What matters is that both sides name the *same kind of thing*, which is what
 * makes them one axis.
 */
export interface RelationSets {
    /**
     * Segment ids that may read the entry. **Empty means everyone**, which is
     * the convention every instance of this scheme uses — an entry nobody
     * bothered to restrict is an open entry, not a closed one.
     */
    readonly included: readonly string[];
    /** Segment ids that may not read it, whatever `included` says. */
    readonly excluded: readonly string[];
}

/**
 * Translates one entry's relation sets into the rule that means the same thing.
 *
 * ## Why this is a function and not a migration script
 *
 * There is no old scheme *in this repository* to migrate from — the scheme
 * lives in the app adopting segmentation, in fields this CMS has never seen,
 * under names only that app knows. A script here would have to invent the input
 * format it claims to read. What is genuinely shared is the **mapping**, and
 * getting it wrong is what produces content that silently opens: so the mapping
 * is the part that ships, with a test, and the adopter's script is a loop that
 * reads their fields, calls this, and posts the result to `/api/access`.
 * `docs/segments-adoption.md` is that loop, written out.
 *
 * ## The three rules of the translation
 *
 * **An empty `included` is not an empty `only`.** This is the whole trap. In
 * the relation scheme an empty include list means *everyone*; in this model an
 * `only` naming nobody admits *nobody*. Translating one to the other literally
 * turns every unrestricted entry in a library dark on the day of the migration
 * — so an empty `included` produces the `all` mode, and the entry stays open.
 *
 * **`excluded` becomes an exclusion, never the complement.** Listing the other
 * three hundred and ninety-seven segments would be storing the complement,
 * which is the one thing the projection invariant forbids: onboarding a new
 * organisation would then have to rewrite every entry in the library.
 *
 * **The result is one group.** The old scheme has no disjunction to preserve —
 * it is a single include list AND-ed with a single exclude list — so a
 * translation that produced several groups would be inventing structure the
 * source never carried.
 */
export function ruleFromRelationSets(
    typeKey: SegmentTypeKey,
    sets: RelationSets
): AuthoredAccessRule {
    const included = unique(sets.included);
    const excluded = unique(sets.excluded);

    return {
        // A group **is** the map from segment type to condition — the
        // `{ conditions }` wrapper belongs to the wire, not to the kernel. An
        // adopter posting this to `/api/access/rules` wraps each group on the
        // way out; the shape the request reads back is the shape it sent.
        //
        // An empty include list produces **no group at all**, not a group whose
        // one condition is `all`. The two admit the same readers, and they are
        // not the same rule: `isUnrestricted` is what keeps an open entry out
        // of the projection, and it asks whether there are zero groups. A rule
        // carrying one vacuous group is "restricted" by that test — so every
        // untouched entry in the library would get a projection row, the read
        // would pay a semi-join for it, and the admin would badge it Restricted
        // while nothing restricted it.
        groups: included.length
            ? [
                  {
                      [typeKey]: {
                          mode: CONDITION_MODE.Only,
                          segmentIds: included
                      }
                  }
              ]
            : [],
        exclusions: excluded.length ? { [typeKey]: excluded } : {}
    };
}

/**
 * Groups entries by the rule they translate to, so an adopter creates a handful
 * of rules rather than one per entry.
 *
 * This is the difference between a usable migration and an unusable one. A
 * library of forty thousand articles carrying the same two subscription tiers
 * has, in practice, a few dozen distinct combinations — and one rule per entry
 * would produce forty thousand rows nobody can read, edit, or reason about,
 * defeating the reuse that made a rule worth having. Entries sharing a
 * combination share a rule and get an assignment each.
 *
 * The signature key is the two **sorted** id lists, because the relation scheme
 * has no order and two entries listing the same segments differently are the
 * same rule. Entries whose sets restrict nobody are returned under
 * {@link RelationSetGrouping.unrestricted} rather than given an empty rule:
 * they need no assignment at all, and the count of them is the first number an
 * adopter should sanity-check against their own.
 */
export function groupByRelationSets<T>(
    entries: readonly { entry: T; sets: RelationSets }[]
): RelationSetGrouping<T> {
    const groups = new Map<string, { sets: RelationSets; entries: T[] }>();
    const unrestricted: T[] = [];

    for (const { entry, sets } of entries) {
        const included = unique(sets.included);
        const excluded = unique(sets.excluded);
        if (!included.length && !excluded.length) {
            unrestricted.push(entry);
            continue;
        }
        const signature = `${included.join(',')}|${excluded.join(',')}`;
        const group = groups.get(signature);
        if (group) {
            group.entries.push(entry);
            continue;
        }
        groups.set(signature, {
            sets: { included, excluded },
            entries: [entry]
        });
    }

    return {
        groups: [...groups.entries()].map(([signature, group]) => ({
            signature,
            sets: group.sets,
            entries: group.entries
        })),
        unrestricted
    };
}

/** One distinct combination, and the entries carrying it. */
export interface RelationSetGroup<T> {
    /** The sorted-id signature the grouping keyed on. */
    signature: string;
    /** The normalised sets — deduplicated and sorted. */
    sets: RelationSets;
    /** Every entry with this combination. */
    entries: readonly T[];
}

/** What {@link groupByRelationSets} returns. */
export interface RelationSetGrouping<T> {
    /** One entry per distinct combination — the rules to create. */
    groups: readonly RelationSetGroup<T>[];
    /** Entries whose sets restrict nobody. They need no rule and no assignment. */
    unrestricted: readonly T[];
}

/**
 * Whether a translation would fit the model, and what to do when it does not.
 *
 * Called before writing anything. The one bound worth checking up front is the
 * group ceiling — an adopter whose scheme carries a genuine disjunction (two
 * independent axes OR-ed) will hit it, and finding out entry by entry through
 * failed writes is a migration that stops half done.
 */
export function relationSetsFit(count: number): boolean {
    return count <= MAX_CONDITION_GROUPS;
}

/** Deduplicated and sorted, so two spellings of one set compare equal. */
function unique(ids: readonly string[]): string[] {
    return [...new Set(ids)].sort();
}
