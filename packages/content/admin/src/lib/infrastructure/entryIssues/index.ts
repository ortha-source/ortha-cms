import { ApiError } from '@orthacms/utils-admin';
import type { EntryValidationIssue } from '../../domain/types/contentType';
import { SIBLING_INVALIDATED_CODE } from '../../domain/constants';

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
    if (codeOf(error) === SIBLING_INVALIDATED_CODE) return [];
    return toIssues((error.details as { issues?: unknown })?.issues);
}

/**
 * The published locale siblings a refused save would have left failing
 * validation — `undefined` unless the error is exactly that refusal, which the
 * editor answers with a confirmation rather than with field errors.
 */
export function invalidatedSiblingsFrom(
    error: unknown
): InvalidatedSibling[] | undefined {
    if (!(error instanceof ApiError) || error.status !== 422) return undefined;
    if (codeOf(error) !== SIBLING_INVALIDATED_CODE) return undefined;
    const siblings = (error.details as { siblings?: unknown })?.siblings;
    if (!Array.isArray(siblings)) return [];
    return siblings
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
