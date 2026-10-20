import { ApiError } from '@orthacms/utils-admin';
import type {
    EntryValidationIssue,
    RelationRef
} from '../../domain/types/contentType';
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
    /** The row's entry id, when the server named it. */
    entryId?: string;
    /**
     * `false` when the row belongs to **another record** (one an inverse
     * link reaches) rather than to the record being saved.
     */
    sibling?: boolean;
};

/** One value another row would take on. */
export type SyncFieldChange = {
    field: string;
    /** The field's label in its own type. */
    label: string;
    before: unknown;
    after: unknown;
};

/**
 * A linked record named in the preview: a {@link RelationRef}, plus whether
 * it is the record being saved (`self`) or a row that exists only inside the
 * refused write (`unsaved`). Neither can be opened yet, and neither carries
 * a status — the server leaves it off rather than report the state the
 * rolled-back write would have left.
 */
export type SyncRef = RelationRef & { self?: true; unsaved?: true };

/** One relation field's links on another row. */
export type SyncLinkChange = {
    field: string;
    label: string;
    /** The linked records' content type name, when the server named it. */
    target?: string;
    added: SyncRef[];
    removed: SyncRef[];
    /**
     * Records the source links that have no translation in this row's
     * language, so the row is left without them.
     */
    unresolved: SyncRef[];
};

/** One other row a save would change, and what changes in it. */
export type SyncChange = {
    /** The row's content type name, and its label. */
    type: string;
    typeLabel: string;
    entryId: string;
    locale: string | null;
    /** The row's display title, when it has one. */
    title: string | null;
    /** A translation of the record being saved, rather than another record. */
    sibling: boolean;
    /** Published before the save — it becomes Modified. */
    published: boolean;
    /** The person may leave this one out (a gap filled in on a create). */
    optional: boolean;
    fields: SyncFieldChange[];
    links: SyncLinkChange[];
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
    /**
     * Every other live row the save would change, with what changes in each.
     * Empty on the invalidation-only refusal, which names no changes.
     */
    changes: SyncChange[];
};

/** A plain object, or `undefined`. */
function objectOf(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

/**
 * Keep only well-formed `{ id, title }` refs. `self` / `unsaved` drop any
 * status a server still sent, so neither can be drawn with one.
 */
function toRefs(value: unknown): SyncRef[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter(
            (ref): ref is SyncRef =>
                typeof objectOf(ref)?.['id'] === 'string' &&
                typeof objectOf(ref)?.['title'] === 'string'
        )
        .map((ref) => {
            const out: SyncRef = { ...ref };
            if (ref.self !== true) delete out.self;
            if (ref.unsaved !== true) delete out.unsaved;
            if (out.self || out.unsaved) delete out.status;
            return out;
        });
}

/** Keep only well-formed changes, defaulting what a server may omit. */
function toChanges(value: unknown): SyncChange[] {
    if (!Array.isArray(value)) return [];
    const out: SyncChange[] = [];
    for (const raw of value) {
        const change = objectOf(raw);
        if (
            !change ||
            typeof change['entryId'] !== 'string' ||
            typeof change['type'] !== 'string'
        )
            continue;
        const fields = Array.isArray(change['fields']) ? change['fields'] : [];
        const links = Array.isArray(change['links']) ? change['links'] : [];
        out.push({
            type: change['type'],
            typeLabel:
                typeof change['typeLabel'] === 'string'
                    ? change['typeLabel']
                    : change['type'],
            entryId: change['entryId'],
            locale:
                typeof change['locale'] === 'string' ? change['locale'] : null,
            title: typeof change['title'] === 'string' ? change['title'] : null,
            sibling: change['sibling'] !== false,
            published: change['published'] === true,
            optional: change['optional'] === true,
            fields: fields.flatMap((rawField) => {
                const field = objectOf(rawField);
                if (typeof field?.['field'] !== 'string') return [];
                return [
                    {
                        field: field['field'],
                        label:
                            typeof field['label'] === 'string'
                                ? field['label']
                                : field['field'],
                        before: field['before'] ?? null,
                        after: field['after'] ?? null
                    }
                ];
            }),
            links: links.flatMap((rawLink) => {
                const link = objectOf(rawLink);
                if (typeof link?.['field'] !== 'string') return [];
                return [
                    {
                        field: link['field'],
                        label:
                            typeof link['label'] === 'string'
                                ? link['label']
                                : link['field'],
                        ...(typeof link['target'] === 'string'
                            ? { target: link['target'] }
                            : {}),
                        added: toRefs(link['added']),
                        removed: toRefs(link['removed']),
                        unresolved: toRefs(link['unresolved'])
                    }
                ];
            })
        });
    }
    return out;
}

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
        .map((sibling) => {
            const raw = sibling as Record<string, unknown>;
            return {
                locale: sibling.locale,
                issues: toIssues(sibling.issues),
                ...(typeof raw['entryId'] === 'string'
                    ? { entryId: raw['entryId'] }
                    : {}),
                ...(raw['sibling'] === false ? { sibling: false } : {})
            };
        });
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
        | { siblings?: unknown; locales?: unknown; changes?: unknown }
        | undefined;
    if (code === SIBLING_SYNC_UNCONFIRMED_CODE) {
        const locales = details?.locales;
        return {
            reached: Array.isArray(locales)
                ? locales.filter(
                      (locale): locale is string => typeof locale === 'string'
                  )
                : [],
            invalidated: toSiblings(details?.siblings),
            changes: toChanges(details?.changes)
        };
    }
    if (code === SIBLING_INVALIDATED_CODE) {
        return {
            reached: [],
            invalidated: toSiblings(details?.siblings),
            changes: []
        };
    }
    return undefined;
}
