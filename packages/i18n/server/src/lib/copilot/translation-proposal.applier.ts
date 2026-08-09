import { Injectable } from '@nestjs/common';
import {
    EntryWriterService,
    InjectContentRegistry,
    WorkspaceGrantsQuery,
    type ContentTypeRegistry
} from '@ortha-cms/content-server';
import type {
    ProposalActor,
    ProposalApplier,
    ProposalApplyResult,
    ProposalTarget
} from '@ortha-cms/copilot-domain';
import { I18N_PROPOSAL_KINDS } from './translation-proposal.provider';

/**
 * Applies `i18n.entry.translate` by creating the sibling row through
 * {@link EntryWriterService.create} — the same call `POST /api/content/:type`
 * makes, with a `localeGroupId`.
 *
 * **There is no "create translation" write path to reuse, and that is the
 * point**: joining an existing group is what `localeGroupId` on a create
 * already means, and the bound entry extension stamps and validates it inside
 * the write transaction. So this applier passes two extra arguments to the
 * ordinary create rather than reaching for a second mechanism — which is also
 * what makes a duplicate `(group, locale)` a clean 409 instead of a corrupt
 * group.
 */
@Injectable()
export class TranslationProposalApplier implements ProposalApplier {
    readonly kind = I18N_PROPOSAL_KINDS.createTranslation;

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
        const typeName = input.target['typeName'];
        const locale = input.target['locale'];
        const localeGroupId = input.target['localeGroupId'];
        if (
            typeof typeName !== 'string' ||
            typeof locale !== 'string' ||
            typeof localeGroupId !== 'string'
        ) {
            throw new Error('This proposal is missing its translation target.');
        }

        // Re-checked rather than trusted from the row: grants can be revoked
        // between proposing and accepting, and a stored type name is an
        // argument like any other.
        const type = this.registry.get(typeName);
        const granted = await this.grants.grantedSlugs(actor.workspaceId);
        if (!type || !granted.has(type.name)) {
            throw new Error(
                `Unknown content type "${typeName}" in this workspace.`
            );
        }

        const values = (input.patch['values'] ?? {}) as Record<string, unknown>;
        const entry = await this.writer.create(
            type,
            values,
            actor.workspaceId,
            undefined,
            locale,
            localeGroupId,
            actor.userId
        );
        return {
            entityId: entry.id,
            detail: { typeName: type.name, locale, localeGroupId }
        };
    }
}
