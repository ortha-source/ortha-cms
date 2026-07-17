/**
 * The pure per-entry publish-verdict logic — shared by the bulk-publish **dry
 * run** (the preview query) and the committed bulk-publish use-case so they can
 * never disagree on what is publishable. Extracted verbatim from the original
 * writer's `verdictsFor`/`buildChecks`; takes the validation as a function so it
 * stays free of DI.
 */

import type { AnyContentType, EntryStatus } from '../../../types/content-type';
import { ENTRY_STATUS } from '../../../types/content-type';
import type {
    ValidationIssue,
    ValidationResult
} from '../../../validation/services/entry-validation.service';
import {
    BULK_VERDICT,
    type BulkPublishCheck,
    type BulkPublishVerdict
} from '../../types/bulk-publish';
import { entryTitle, toRecord } from './entry-row';

/** A generated content row seen as a bag of values by property name. */
type Row = Record<string, unknown>;

/** How the caller runs value validation (the injectable service's `validate`). */
export type ValidateEntry = (
    type: AnyContentType,
    values: Record<string, unknown>
) => ValidationResult;

/**
 * Compute the per-entry publish verdict (will-publish / already-published /
 * blocked / not-found) for `ids` in request order, given the live rows keyed by
 * id and a value-validation function.
 */
export function computeBulkPublishVerdicts(
    type: AnyContentType,
    ids: string[],
    byId: Map<string, Row>,
    validate: ValidateEntry
): BulkPublishVerdict[] {
    return ids.map((id): BulkPublishVerdict => {
        const row = byId.get(id);
        if (!row) {
            return {
                id,
                title: id,
                status: null,
                verdict: BULK_VERDICT.NotFound,
                issues: [],
                checks: []
            };
        }
        const title = entryTitle(type, row);
        const status = row['status'] as EntryStatus;
        if (status === ENTRY_STATUS.Published) {
            // Already published, so nothing will change — but still surface its
            // per-field gate (an already-published row is valid, so the checks
            // all pass) so the dialog can expand it like every other row instead
            // of leaving it a dead, non-collapsible entry.
            const result = validate(type, toRecord(type, row).values);
            return {
                id,
                title,
                status,
                verdict: BULK_VERDICT.AlreadyPublished,
                issues: [],
                checks: buildChecks(type, result.issues)
            };
        }
        const result = validate(type, toRecord(type, row).values);
        return {
            id,
            title,
            status,
            verdict: result.valid
                ? BULK_VERDICT.Publishable
                : BULK_VERDICT.Blocked,
            issues: result.issues,
            checks: buildChecks(type, result.issues)
        };
    });
}

/**
 * The per-field publish-gate checklist for one record: every required field plus
 * any field that has an issue, each marked pass/fail. Mirrors the editor's
 * Publish Gate so a row can show its passed fields, not just the failures.
 */
function buildChecks(
    type: AnyContentType,
    issues: ValidationIssue[]
): BulkPublishCheck[] {
    const byField = new Map<string, string>();
    for (const issue of issues) {
        if (!byField.has(issue.field)) byField.set(issue.field, issue.message);
    }
    return Object.entries(type.fields)
        .filter(([name, spec]) => spec.required || byField.has(name))
        .map(([name, spec]) => ({
            field: name,
            label: spec.admin.label ?? name,
            ok: !byField.has(name),
            message: byField.get(name)
        }));
}
