import { Injectable, NotFoundException } from '@nestjs/common';
import type { AnyContentType } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../../types/fields';
import { EntryWriterService } from '../../../entries/infrastructure/persistence/entry-writer.service';
import type { EntryRecord } from '../../../entries/types/entry-list-view';
import {
    InjectRevisionStore,
    type RevisionStore
} from '../ports/revision-store';

/**
 * Restore an entry to an earlier revision. History is **append-only** — a
 * restore never rewrites or deletes past versions: it applies the chosen
 * snapshot back onto the live row through the normal save path, which in turn
 * records the restore as a **new** draft revision (so v5 restoring v2 yields a
 * fresh v6 equal to v2). The snapshot's `values` (scalars, localized + shared
 * fields, single-relation FKs) and its owning many-to-many link sets are
 * re-applied; inverse relations mirror their owning side and aren't written from
 * here.
 */
@Injectable()
export class RestoreRevisionUseCase {
    constructor(
        private readonly writer: EntryWriterService,
        @InjectRevisionStore() private readonly store: RevisionStore
    ) {}

    async execute(
        type: AnyContentType,
        id: string,
        number: number,
        workspaceId: string,
        actorId: string | null
    ): Promise<EntryRecord> {
        const detail = await this.store.get(id, workspaceId, number);
        if (!detail) {
            throw new NotFoundException(
                `No revision #${number} for entry "${id}" on "${type.name}".`
            );
        }
        // Merge the snapshot's owning many-to-many link sets into the values bag
        // so the writer's whole-set `writeLinks` re-applies them; single FKs and
        // scalar/localized values already ride `values`.
        const values: Record<string, unknown> = { ...detail.snapshot.values };
        for (const [field, ids] of Object.entries(detail.snapshot.relations)) {
            const spec = type.fields[field];
            if (
                spec?.type === CONTENT_FIELD_TYPE.Relation &&
                spec.relation?.many &&
                !spec.relation.inverse
            ) {
                values[field] = ids;
            }
        }
        return this.writer.update(
            type,
            id,
            values,
            workspaceId,
            undefined,
            actorId
        );
    }
}
