import { ApiError } from '@orthacms/utils-admin';
import type { EntryValidationIssue } from '../../domain/types/contentType';
import {
    SIBLING_INVALIDATED_CODE,
    SIBLING_SYNC_UNCONFIRMED_CODE
} from '../../domain/constants';

/** One published locale sibling a save would leave failing validation. */
export type InvalidatedSibling = {
    /** The sibling's locale slug. */
    locale: string;
    /** The fields that would fail there. */
    issues: EntryValidationIssue[];
};

/** Keep only well-formed `{ field, message }` entries. */
function toIssues(value: unknown): EntryValidationIssue[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (issue): issue is EntryValidationIssue =>
            typeof issue === 'object' &&
            issue !== null &&
            typeof (issue as EntryValidationIssue).field === 'string' &&
            typeof (issue as EntryValidationIssue).message === 'string'
    );
}

/** The 422 body's `code`, when it carries one. */
function codeOf(error: ApiError): unknown {
    return (error.details as { code?: unknown } | undefined)?.code;
}

/**
 * Pull the per-field validation issues out of a write error. The entry-write API
 * returns 422 with a `{ message, issues: [{ field, message }] }` body on a
 * validation failure; everything else (404, 403, network) has no issues. Returns
 * `[]` for any non-422 / unshaped error so callers can branch on `length`.
 *
 * A **sibling invalidation** (see {@link invalidatedSiblingsFrom}) returns `[]`
 * too: its issues are about *other* locale rows, and pinning them on this form
 * marked fields the author had not touched — or had filled — as failing.
 */
export function entryIssuesFrom(error: unknown): EntryValidationIssue[] {
    if (!(error instanceof ApiError) || error.status !== 422) return [];
    const code = codeOf(error);
    if (code === SIBLING_INVALIDATED_CODE) return [];
    if (code === SIBLING_SYNC_UNCONFIRMED_CODE) return [];
    return toIssues((error.details as { issues?: unknown })?.issues);
}

/**
 * What a save refused for reaching other locale siblings would have done —
 * the answer to {@link siblingSyncRefusalFrom}.
 */
export type SiblingSyncRefusal = {
    /**
     * Every **live** sibling the save would change, by locale slug. Empty when
     * the server only reported invalidations (the refusal to a save sent
     * without asking first), where the invalidated ones are all it named.
     */
    reached: string[];
    /** The **published** siblings it would leave failing validation. */
    invalidated: InvalidatedSibling[];
};

/** Keep only well-formed `{ locale, issues }` entries. */
function toSiblings(value: unknown): InvalidatedSibling[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter(
            (sibling): sibling is { locale: string; issues?: unknown } =>
                typeof sibling === 'object' &&
                sibling !== null &&
                typeof (sibling as { locale?: unknown }).locale === 'string'
        )
        .map((sibling) => ({
            locale: sibling.locale,
            issues: toIssues(sibling.issues)
        }));
}

/**
 * The siblings a refused save would have reached — `undefined` unless the
 * error is one of the two refusals the editor answers with a confirmation
 * rather than with field errors:
 *
 * - **asked first** (`askBeforeSiblingSync`): the save would change other
 *   live locales — named in `reached` — and possibly leave published ones
 *   invalid. Nothing was written.
 * - **invalidation**: a save sent without asking would leave published
 *   siblings failing validation. Only those are named, so `reached` is empty.
 *   The editor sees this one when a sibling changed between asking and
 *   confirming, which is why the same dialog has to answer both.
 */
export function siblingSyncRefusalFrom(
    error: unknown
): SiblingSyncRefusal | undefined {
    if (!(error instanceof ApiError) || error.status !== 422) return undefined;
    const code = codeOf(error);
    const details = error.details as
        | { siblings?: unknown; locales?: unknown }
        | undefined;
    if (code === SIBLING_SYNC_UNCONFIRMED_CODE) {
        const locales = details?.locales;
        return {
            reached: Array.isArray(locales)
                ? locales.filter(
                      (locale): locale is string => typeof locale === 'string'
                  )
                : [],
            invalidated: toSiblings(details?.siblings)
        };
    }
    if (code === SIBLING_INVALIDATED_CODE) {
        return { reached: [], invalidated: toSiblings(details?.siblings) };
    }
    return undefined;
}
