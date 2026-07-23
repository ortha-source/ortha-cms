import { Injectable } from '@nestjs/common';
import type { AnyContentType } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../../types/fields';
import { RelationLinkService } from '../../../entries/infrastructure/persistence/relation-link.service';
import type { RelationRef } from '../../../entries/types/entry-list-view';
import type { RevisionDetail } from '../../types/revision-view';
import { PREVIEW_RELATION_REF_CAP } from '../../revisions.constants';

/**
 * Enriches a {@link RevisionDetail} with its relation fields resolved to display
 * refs — the "exact list of linked records" the preview shows instead of raw
 * uuids. A single (owning) relation resolves its FK id from `snapshot.values`; a
 * join-backed relation (owning many-to-many, or an inverse) resolves its ordered
 * id list from `snapshot.relations`. Each field is capped at
 * {@link PREVIEW_RELATION_REF_CAP}; the true count rides in `relationTotals` so
 * the UI can show a "+N more". Reuses {@link RelationLinkService.resolveRefs}, so
 * a soft-deleted / cross-workspace target reads as a `missing` ref exactly as it
 * does on the live relations read (no title leak, no enumeration signal).
 */
@Injectable()
export class RevisionRefsQuery {
    constructor(private readonly relations: RelationLinkService) {}

    async enrich(
        type: AnyContentType,
        detail: RevisionDetail,
        workspaceId: string
    ): Promise<RevisionDetail> {
        const relationRefs: Record<string, RelationRef[]> = {};
        const relationTotals: Record<string, number> = {};

        for (const [name, spec] of Object.entries(type.fields)) {
            if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation) {
                continue;
            }
            const relation = spec.relation;
            const joinBacked = !!relation.many || !!relation.inverse;
            const ids = joinBacked
                ? (detail.snapshot.relations[name] ?? [])
                : singleFkIds(detail.snapshot.values[name]);
            if (!ids.length) continue;

            relationTotals[name] = ids.length;
            relationRefs[name] = await this.relations.resolveRefs(
                relation.to(),
                ids,
                workspaceId,
                PREVIEW_RELATION_REF_CAP
            );
        }

        return { ...detail, relationRefs, relationTotals };
    }
}

/** A single-relation FK value → a 0/1-length id list. */
function singleFkIds(value: unknown): string[] {
    return typeof value === 'string' && value ? [value] : [];
}
