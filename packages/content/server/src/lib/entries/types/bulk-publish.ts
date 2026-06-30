/**
 * Wire contracts for the bulk-publish dry run and its commit. The preview is
 * advisory (the admin renders it in a confirm modal); the commit re-validates
 * server-side and never trusts the client's copy.
 */

import type { EntryStatus } from '../../types/content-type';
import type { ValidationIssue } from '../../validation/services/entry-validation.service';

/**
 * The outcome of dry-running a publish against one selected entry. The runtime
 * object is the source of truth so the admin and server share the verdict set.
 */
export const BULK_VERDICT = {
    /** Currently a draft and valid — will publish. */
    Publishable: 'publishable',
    /** Already published — nothing to do. */
    AlreadyPublished: 'already-published',
    /** Has validation issues — cannot publish until fixed. */
    Blocked: 'blocked',
    /** No live row with this id (unknown or soft-deleted). */
    NotFound: 'not-found'
} as const;

/** One row's dry-run verdict. */
export type BulkVerdictKind =
    (typeof BULK_VERDICT)[keyof typeof BULK_VERDICT];

/**
 * One field's publish-gate check: whether it currently passes (and, when it
 * doesn't, why). Lets the admin show a full per-record checklist — passed fields
 * included — not just the failures.
 */
export interface BulkPublishCheck {
    /** Field name. */
    field: string;
    /** Human label (admin label, else the field name). */
    label: string;
    /** Whether the field passes publish validation. */
    ok: boolean;
    /** The failure message when `ok` is false. */
    message?: string;
}

/** Per-entry result in a bulk-publish dry run. */
export interface BulkPublishVerdict {
    id: string;
    /** Display label (first text field, else id). */
    title: string;
    /** Current publish state, or null when not found. */
    status: EntryStatus | null;
    verdict: BulkVerdictKind;
    /** Populated only when `verdict === 'blocked'`. */
    issues: ValidationIssue[];
    /**
     * Per-field publish-gate checks (required fields + any field with an issue),
     * for a record that was actually validated (`publishable`/`blocked`); empty
     * for already-published / not-found rows.
     */
    checks: BulkPublishCheck[];
}

/** The dry-run response: one verdict per requested id, in request order. */
export interface BulkPublishPreview {
    items: BulkPublishVerdict[];
}

/** The result of committing a bulk publish. */
export interface BulkPublishResult {
    /** Ids actually transitioned to published. */
    published: string[];
    /** Ids left untouched, with why (a non-publishable verdict kind). */
    skipped: { id: string; reason: BulkVerdictKind }[];
}

/** The result of a bulk unpublish/delete/restore — how many rows changed. */
export interface BulkActionResult {
    count: number;
}
