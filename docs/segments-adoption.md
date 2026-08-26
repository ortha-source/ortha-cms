# Adopting segmentation from an included/excluded relation scheme

Most CMSes reach for the same shape before they reach for segmentation: two
relation fields on the entry — one listing who may read it, one listing who may
not — and application code that filters by them. This is how to move that to
[`@orthacms/segments-server`](../packages/segments/server/AGENTS.md) without a
window in which content is readable by the wrong people, or invisible to the
right ones.

There is **no migration script in this repository**, and that is deliberate: the
old scheme lives in the adopting app's own fields, under names only that app
knows, in a database this CMS has never seen. A script here would have to invent
the input format it claims to read. What ships instead is the part that is
genuinely shared and genuinely easy to get wrong — the **mapping** — as three
tested functions in `@orthacms/segments-domain`. The loop around them is below;
it is short, and it is yours.

## The mapping, and the one trap in it

| Relation scheme                         | Segmentation                            |
| --------------------------------------- | --------------------------------------- |
| the relation target (a plan, a company) | a **segment** in one segment type       |
| `included: [pro, team]`                 | a group with `only: [pro, team]`        |
| `included: []`                          | **no group at all** — the entry is open |
| `excluded: [globex]`                    | a rule-level **exclusion**              |
| one entry's pair of lists               | one rule, assigned to that entry        |

**`included: []` means everyone, and an `only` naming nobody means nobody.** The
two look like the same emptiness and are opposite. Translating one to the other
literally turns every unrestricted entry in the library dark on the day of the
migration — a failure that looks like an outage and is really one line of
translation. `ruleFromRelationSets` emits no group for an empty include list,
which is what keeps the entry out of the projection entirely rather than
projecting a vacuous "restricted" row.

**An exclusion is stored as an exclusion, never as its complement.** "Everyone
except Globex" is one denied segment, not three hundred and ninety-nine admitted
ones. Storing the complement would mean rewriting every entry in the library
each time an organisation is onboarded — the single most expensive mistake this
model is shaped to prevent.

## The loop

```ts
import {
    groupByRelationSets,
    ruleFromRelationSets
} from '@orthacms/segments-domain';

// 1. One segment type per axis. Do this once, in the admin (Segmentation →
//    New type) or in `ortha.config.ts`. The key is the tag namespace your
//    readers will carry: `plan` gives `plan:pro`.
//
// 2. One segment per relation target. POST each to
//    /api/access/segment-types/plan/segments — the tag defaults to
//    `plan:<key>`, which is what you want unless your readers already carry a
//    different identifier, in which case pass it as `tags`.
//    Keep the mapping from your old relation-target id to the new segment id.

// 3. Read your entries and translate. Group first: a library of forty thousand
//    articles carrying the same two tiers has a few dozen distinct
//    combinations, and one rule per entry would produce forty thousand rows
//    nobody can read or edit.
const { groups, unrestricted } = groupByRelationSets(
    entries.map((entry) => ({
        entry,
        sets: {
            included: entry.subscriptions.map((id) => segmentIdFor(id)),
            excluded: entry.excludedSubscriptions.map((id) => segmentIdFor(id))
        }
    }))
);

// `unrestricted` needs no rule and no assignment. Check its size against your
// own count of open entries before writing anything — it is the cheapest
// sanity check available, and a mismatch here means the id mapping is wrong.
console.log(`${unrestricted.length} entries are open and will stay open.`);

// 4. One rule per group, then one assignment per entry.
for (const [index, group] of groups.entries()) {
    const rule = ruleFromRelationSets('plan', group.sets);

    const created = await post('/api/access/rules', {
        key: `imported-${index + 1}`,
        label: describe(group.sets),
        // A group *is* the map from segment type to condition; the
        // `{ conditions }` wrapper belongs to the wire.
        groups: rule.groups?.map((g) => ({ conditions: g })) ?? [],
        exclusions: rule.exclusions
    });

    for (const entry of group.entries) {
        await post('/api/access/assignments', {
            ruleId: created.id,
            target: { kind: 'entry', typeSlug: 'article', entryId: entry.id }
        });
    }
}
```

Every assignment re-projects its target before it answers, so a 200 means
readers are already being served the new decision. That also means the import is
**resumable**: an assignment is a replace, so re-running the loop over entries
already done writes the same rows again rather than doubling anything.

## Before you cut over

**Run it against a copy first, then compare counts.** The number of entries in
`unrestricted` should match your own count of entries with both lists empty, and
the number of rules should be far smaller than the number of entries. If it
isn't, the id mapping is producing distinct-looking sets from identical ones —
usually because the old ids were not deduplicated. `groupByRelationSets`
deduplicates and sorts, so a mismatch is upstream.

**Check a handful with `explain` before deleting anything.** `POST
/api/access/explain` with a reader's tags runs the real decision and reports
every step. Do it for one entry per rule, with a reader who should see it and
one who should not, and only then stop consulting the old relation fields.

**Keep the old fields until the reads are switched over.** Nothing about this
migration writes to them, so they remain the answer your application code is
still using. Delete them after the API is serving from segmentation and you have
watched it for a while — segmentation narrows the read itself, so a mistake
surfaces as missing content rather than as an error, and missing content takes
longer to notice than a 500.

## What does not translate

**A genuine disjunction across two axes.** `(Acme) OR (EU AND Pro)` is
expressible as two condition groups, but nothing in the relation scheme carries
it, so nothing in the mapping produces it — a translated rule always has at most
one group. If your application code has grown an OR of its own on top of the two
lists, that logic has to be authored by hand as extra groups.
`relationSetsFit(n)` is the ceiling check (eight groups per rule).

**Per-locale differences.** Rules attach to an entry id, and a localized record
is one row per locale. If your old scheme restricted the record rather than the
row, assign the rule to each locale sibling — or, more usually, assign it to the
content type once and let inheritance cover every row.

**Time windows and fallbacks.** The relation scheme has neither. `startsAt` /
`endsAt` and the `hidden` / `teaser` / `paywall` fallback are things you gain,
not things to translate; the import leaves them at their defaults (no window,
`teaser`).
