import type { ProtectedTypeRow, ProtectionRuleRecord } from './types';

/** The shape of a content type this needs — a subset of content's own. */
export type GrantableContentType = {
    /** Machine name; the `slug` half of a rule's address. */
    name: string;
    /** `collection` or `single`; the `kind` half. */
    kind: string;
    /** Human label. */
    label: string;
    /** Whether the type has a `draft → published` transition at all. */
    publishable?: boolean;
};

/**
 * The rows the Protection tab lists: the workspace's **granted** content types,
 * each carrying the rule it holds or `null`.
 *
 * Three rules, and each one is a decision rather than a filter:
 *
 * **The list is the grants, not the rules.** A granted type nobody has
 * protected has to appear or there would be no way to protect the first one.
 * The rule's address is `(workspace, kind, slug)` — exactly the pair
 * `workspace_content` grants — so no type picker is invented here.
 *
 * **A non-publishable type is left out.** Protection guards the
 * `draft → published` transition, and a type that is always live has no
 * transition to hold. Listing one would offer a rule that could never fire, and
 * the entry editor already renders nothing for it (`reviewScopeOf`).
 *
 * **A rule whose type is no longer granted still appears**, at the end and
 * flagged. The API returns those deliberately — they are the rows an
 * administrator needs in order to remove them — and dropping them here would
 * leave a rule nobody can see and nobody can delete.
 */
export function protectedTypeRows(
    granted: readonly string[],
    types: readonly GrantableContentType[],
    rules: readonly ProtectionRuleRecord[]
): { rows: ProtectedTypeRow[]; orphans: ProtectionRuleRecord[] } {
    const byName = new Map(types.map((type) => [type.name, type]));
    const bySlug = new Map(rules.map((rule) => [rule.slug, rule]));

    const rows = granted
        .map((slug) => byName.get(slug))
        .filter(
            (type): type is GrantableContentType =>
                !!type && type.publishable === true
        )
        .map((type) => ({
            slug: type.name,
            kind: type.kind,
            label: type.label || type.name,
            rule: bySlug.get(type.name) ?? null
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const listed = new Set(rows.map((row) => row.slug));
    const orphans = rules.filter((rule) => !listed.has(rule.slug));

    return { rows, orphans };
}
