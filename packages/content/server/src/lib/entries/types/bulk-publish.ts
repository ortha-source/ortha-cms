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
    NotFound: 'not-found',
    /**
     * A registered publish guard refused it — approvals outstanding, typically.
     *
     * Only ever produced by the **commit**, never by the dry run: a guard's
     * answer needs the database and the preview is a pure function over rows
     * already loaded. That asymmetry is the reason bulk publish has always been
     * partial-success and re-validates server-side rather than trusting the
     * client's copy.
     *
     * It is also how *publish every locale* answers per locale: the i18n menu
     * sends the sibling ids as one bulk publish, so a per-id verdict **is** a
     * per-locale verdict, and the caller learns which translations are held up
     * instead of watching the whole action refuse.
     */
    GuardRefused: 'guard-refused'
} as const;

/** One row's dry-run verdict. */
export type BulkVerdictKind = (typeof BULK_VERDICT)[keyof typeof BULK_VERDICT];

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
     * for any record the server validated — `publishable`, `blocked`, and
     * `already-published` (whose checks all pass). Empty only for a `not-found`
     * row, which has no record to check.
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

/**
 * One record as the publish context describes it — enough to name it, place it
 * in its translation group and say what publishing it would change. Shared by
 * the requested entries and their linked drafts.
 */
export interface PublishContextRecord {
    id: string;
    /** The content type's name — a linked draft may be of another type. */
    type: string;
    /** Display title; absent when the row has none (never the id standing in). */
    title?: string;
    status: EntryStatus;
    /** When it last went live, or `null` if never — separates Draft from Modified. */
    publishedAt: string | null;
    /** The row's locale — localized types only. */
    locale?: string;
    /** The row's translation group — localized types only. */
    localeGroupId?: string;
}

/** A draft one of the requested entries links to, and through which field. */
export interface PublishContextLink extends PublishContextRecord {
    /** The relation field on the requested entry. */
    field: string;
    /** That field's admin label, else its name. */
    fieldLabel: string;
}

/** One requested entry and the unpublished records it links to. */
export interface PublishContextEntry extends PublishContextRecord {
    /**
     * Unpublished records this entry links to through its own relation fields
     * (one hop), in field order — only targets this workspace may publish:
     * a publishable type it holds an own grant for, a row it owns.
     */
    linked: PublishContextLink[];
    /** Whether {@link linked} was cut at `PUBLISH_CONTEXT_MAX_LINKED`. */
    linkedTruncated: boolean;
}

/**
 * The publish-context response: per requested id, the entry and its linked
 * drafts, or `null` when the id names no live row in the workspace.
 */
export interface PublishContextView {
    entries: Record<string, PublishContextEntry | null>;
}
