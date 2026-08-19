/**
 * The BCP-47 language tag — what a `lang` marker on a node, a mark or a field
 * has to be for a screen reader to switch voices on it (WCAG 3.1.2).
 *
 * **Well-formedness, not validity.** A registry check ("is `zz` a real
 * language?") needs the IANA subtag registry, which is a data set that goes
 * stale and has no business inside a dependency-free kernel. Well-formedness
 * is the part that is decidable from the string, and it is the part that
 * actually breaks assistive tech: `en_US` (an underscore, a POSIX locale) and
 * `english` are ignored outright, while `en-GB` and `zh-Hans-CN` work.
 */

/**
 * BCP-47 `langtag`, narrowed to the forms content realistically carries: a 2-3
 * letter language (or 4-8 for a registered one), optional script, optional
 * region, optional variants and extensions. Grandfathered and private-use
 * (`x-…`) tags are accepted whole rather than picked apart.
 */
const LANGUAGE_TAG_RE =
    /^(?:[a-z]{2,3}(?:-[a-z]{3}){0,3}|[a-z]{4,8})(?:-[a-z]{4})?(?:-(?:[a-z]{2}|\d{3}))?(?:-(?:[\da-z]{5,8}|\d[\da-z]{3}))*(?:-[\da-wy-z](?:-[\da-z]{2,8})+)*(?:-x(?:-[\da-z]{1,8})+)?$/i;

/** A private-use tag (`x-klingon`) — legal on its own, and opaque by design. */
const PRIVATE_USE_RE = /^x(?:-[\da-z]{1,8})+$/i;

/**
 * Whether `tag` is a well-formed BCP-47 language tag. Blank is **not** — an
 * empty `lang` is worse than none at all, because it tells assistive tech to
 * treat the passage as having no known language rather than inheriting the
 * page's.
 */
export function isWellFormedLanguageTag(tag: string): boolean {
    const trimmed = tag.trim();
    if (trimmed === '' || trimmed.length > 35) return false;
    return PRIVATE_USE_RE.test(trimmed) || LANGUAGE_TAG_RE.test(trimmed);
}
