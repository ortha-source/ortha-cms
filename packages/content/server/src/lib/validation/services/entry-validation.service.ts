/**
 * Server-side validation of entry values against a content type's field
 * specs. The single authority — the admin renders the same rules
 * client-side as a courtesy, but nothing publishes without passing here.
 *
 * The rules themselves live in the shared `@orthacms/content-domain` kernel
 * (pure, DB-free, unit-tested there); this stays as the injectable wrapper the
 * rest of the plugin and downstream plugins depend on, adapting a runtime
 * {@link AnyContentType} to the kernel's serialized-field-spec input. A content
 * type's `fields` (`AnyFieldSpec`) is structurally an `EntryFieldSpec` map, so
 * the delegation needs no adapter.
 */

import { Injectable, Optional } from '@nestjs/common';
import type { Database } from '@orthacms/database';
import {
    validateEntryValues,
    type ValidationResult
} from '@orthacms/content-domain';
import type { AnyContentType } from '../../types/content-type';
import { WorkspaceGrantsQuery } from '../../content-types/queries/workspace-grants.query';
import {
    hasRequiredRelation,
    waivedRequiredRelations
} from '../required-relation-waiver';

// Re-exported so the plugin's historical import sites (and the public barrel)
// keep resolving these from here even though the definitions moved to the
// kernel.
export type {
    ValidationIssue,
    ValidationResult
} from '@orthacms/content-domain';

/** No waived fields — shared so the common case allocates nothing. */
const NONE: ReadonlySet<string> = new Set();

@Injectable()
export class EntryValidationService {
    constructor(
        /**
         * The workspace's content grants, read to decide which required
         * relations point at a type the workspace cannot reach (see
         * {@link waivedRequired}). Optional so a hand-built service — every
         * unit test — keeps the strict behaviour: with no grants to consult
         * nothing is waived, which fails closed.
         */
        @Optional() private readonly grants?: WorkspaceGrantsQuery
    ) {}

    /**
     * Validates a values object against a content type. Unknown keys are
     * rejected — the schema is the contract, not a suggestion. Delegates the
     * rules to the shared kernel.
     *
     * `waived` names fields whose `required` flag does not apply — pass what
     * {@link waivedRequired} returns for the entry's workspace.
     */
    validate(
        type: AnyContentType,
        values: Record<string, unknown>,
        waived: ReadonlySet<string> = NONE
    ): ValidationResult {
        return validateEntryValues(type.fields, values, {
            rejectUnknownKeys: true,
            typeName: type.name,
            waiveRequired: waived
        });
    }

    /**
     * The required relations of `type` that are **not** required in
     * `workspaceId`, because the workspace holds no content grant for their
     * target type (see `waivedRequiredRelations`). The one place requiredness
     * is decided per workspace: the values gate ({@link validate}), the
     * link-managed relation count and the publish gates all take their waiver
     * from here, so no path can require what another path excuses.
     *
     * Reads nothing when the type has no required relation. `exec` is the
     * caller's transaction, when it has one.
     */
    async waivedRequired(
        type: AnyContentType,
        workspaceId: string,
        exec?: Pick<Database, 'select'>
    ): Promise<ReadonlySet<string>> {
        if (!this.grants || !hasRequiredRelation(type)) return NONE;
        const granted = await this.grants.grantedSlugs(workspaceId, exec);
        return waivedRequiredRelations(type, granted);
    }
}
