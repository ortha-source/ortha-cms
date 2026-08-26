import { Inject, Injectable } from '@nestjs/common';
import type { SavedView } from '../../domain/saved-view';
import {
    SAVED_VIEW_REPOSITORY,
    type SavedViewRecord,
    type SavedViewRepository
} from '../../domain/saved-view.repository';

/**
 * The read side: every view a caller may see for one list, with the two
 * per-caller flags the switcher renders from (`isOwn` gates Save and Delete,
 * `isDefault` marks the row and drives the landing view).
 */
@Injectable()
export class SavedViewsQuery {
    constructor(
        @Inject(SAVED_VIEW_REPOSITORY)
        private readonly repository: SavedViewRepository
    ) {}

    /** Views visible to `readerId` in this workspace + scope. */
    async list(
        workspaceId: string,
        scope: string,
        readerId: string
    ): Promise<SavedView[]> {
        const [records, defaultId] = await Promise.all([
            this.repository.listVisible(workspaceId, scope, readerId),
            this.repository.findDefaultId(readerId, scope)
        ]);
        return records.map((record) =>
            toSavedView(record, readerId, defaultId)
        );
    }
}

/** Projects a stored row into the API shape for one reader. */
export function toSavedView(
    record: SavedViewRecord,
    readerId: string,
    defaultId: string | null
): SavedView {
    return {
        id: record.id,
        scope: record.scope,
        name: record.name,
        visibility: record.visibility,
        ownerId: record.ownerId,
        isOwn: record.ownerId === readerId,
        isDefault: record.id === defaultId,
        payload: record.payload,
        updatedAt: record.updatedAt.toISOString()
    };
}
