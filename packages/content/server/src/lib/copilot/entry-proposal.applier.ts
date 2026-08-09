import { Injectable } from '@nestjs/common';
import type {
    ProposalActor,
    ProposalApplier,
    ProposalApplyResult,
    ProposalTarget
} from '@ortha-cms/copilot-domain';
import { InjectContentRegistry } from '../content.tokens';
import type { ContentTypeRegistry } from '../registry/content-type-registry';
import { EntryWriterService } from '../entries/infrastructure/persistence/entry-writer.service';
import { WorkspaceGrantsQuery } from '../content-types/queries/workspace-grants.query';
import { CONTENT_PROPOSAL_KINDS } from './proposal-kinds';

/** Resolves a granted, registered type or throws — shared by both appliers. */
async function grantedType(
    registry: ContentTypeRegistry,
    grants: WorkspaceGrantsQuery,
    typeName: unknown,
    workspaceId: string
) {
    const name = typeof typeName === 'string' ? typeName : '';
    const type = registry.get(name);
    const granted = await grants.grantedSlugs(workspaceId);
    if (!type || !granted.has(type.name)) {
        throw new Error(`Unknown content type "${name}" in this workspace.`);
    }
    return type;
}

/**
 * Applies `content.entry.create` — a new draft entry.
 *
 * **It calls `EntryWriterService.create`, the same method the POST route
 * calls.** Not "similar to": the same. That is what makes an accepted proposal
 * validated by `EntryValidationService`, wrapped in the workspace's shared
 * advisory lock, snapshotted as revision 1, and passed through the bound i18n
 * extension exactly as a hand-typed entry would be
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §5).
 * An applier that reimplemented the insert to "keep it simple" is the failure
 * the port exists to prevent.
 *
 * The grants are re-checked here, not trusted from the proposal. The row was
 * written when the proposal was made, and a workspace's content grants can be
 * revoked in between — a stored `typeName` is an argument like any other.
 */
@Injectable()
export class CreateEntryProposalApplier implements ProposalApplier {
    readonly kind = CONTENT_PROPOSAL_KINDS.createEntry;

    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService,
        private readonly grants: WorkspaceGrantsQuery
    ) {}

    async apply(
        input: { target: ProposalTarget; patch: Record<string, unknown> },
        actor: ProposalActor
    ): Promise<ProposalApplyResult> {
        const type = await grantedType(
            this.registry,
            this.grants,
            input.target['typeName'],
            actor.workspaceId
        );
        const values = (input.patch['values'] ?? {}) as Record<string, unknown>;
        const locale = input.target['locale'];
        const localeGroupId = input.target['localeGroupId'];

        const entry = await this.writer.create(
            type,
            values,
            actor.workspaceId,
            // No relation *deltas*. An owning many-relation still lands: it
            // travels as an array in `values`, which the writer turns into a
            // whole-set link write. Deltas are the editor's incremental path
            // and have no caller here.
            undefined,
            typeof locale === 'string' ? locale : undefined,
            typeof localeGroupId === 'string' ? localeGroupId : undefined,
            // The human who accepted is the actor on the write and on its
            // revision — never a copilot identity, which does not exist.
            actor.userId
        );
        return {
            entityId: entry.id,
            detail: { typeName: type.name, status: entry.status ?? 'draft' }
        };
    }
}

/**
 * Applies `content.entry.update` — a change to an existing entry's values.
 *
 * **Merges rather than replaces.** The admin's `PATCH` replaces the whole
 * values bag because the editor always submits the full document; a proposal
 * carries only the fields a reviewer approved, so replacing would silently null
 * everything they did not see. This is the same reasoning — and the same merge
 * semantics — as the public API's partial update.
 *
 * The merge reads the entry **now**, not when the proposal was made, so a
 * proposal accepted an hour later writes the approved fields onto whatever the
 * entry has become instead of resurrecting a stale document. A reviewer
 * approving "fix this typo" gets that typo fixed, not the rest of the entry
 * rewound.
 */
@Injectable()
export class UpdateEntryProposalApplier implements ProposalApplier {
    readonly kind = CONTENT_PROPOSAL_KINDS.updateEntry;

    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService,
        private readonly grants: WorkspaceGrantsQuery
    ) {}

    async apply(
        input: { target: ProposalTarget; patch: Record<string, unknown> },
        actor: ProposalActor
    ): Promise<ProposalApplyResult> {
        const type = await grantedType(
            this.registry,
            this.grants,
            input.target['typeName'],
            actor.workspaceId
        );
        const entryId = input.target['entryId'];
        if (typeof entryId !== 'string') {
            throw new Error('This proposal names no entry.');
        }

        // 404s a missing or soft-deleted entry, workspace-scoped — so a
        // proposal whose target was deleted before it was accepted fails with
        // that reason rather than creating something.
        const current = await this.writer.getOne(
            type,
            entryId,
            actor.workspaceId
        );
        const patch = (input.patch['values'] ?? {}) as Record<string, unknown>;
        const merged = { ...(current.values ?? {}), ...patch };

        const entry = await this.writer.update(
            type,
            entryId,
            merged,
            actor.workspaceId,
            undefined,
            actor.userId
        );
        return {
            entityId: entry.id,
            detail: {
                typeName: type.name,
                fields: Object.keys(patch),
                status: entry.status ?? 'draft'
            }
        };
    }
}
