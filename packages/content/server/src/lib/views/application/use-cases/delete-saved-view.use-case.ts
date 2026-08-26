import { Inject, Injectable } from '@nestjs/common';
import type { PublicUser } from '@orthacms/identity-server';
import {
    SAVED_VIEW_REPOSITORY,
    type SavedViewRepository
} from '../../domain/saved-view.repository';
import { SavedViewNotFoundError } from '../../domain/errors';
import { SavedViewAccessService } from '../saved-view-access.service';

/**
 * Deletes a view the caller owns. Anyone else's default pointing at it is
 * cascaded away by the FK, so they fall back to the unfiltered list rather than
 * to a dangling id.
 */
@Injectable()
export class DeleteSavedViewUseCase {
    constructor(
        @Inject(SAVED_VIEW_REPOSITORY)
        private readonly repository: SavedViewRepository,
        private readonly access: SavedViewAccessService
    ) {}

    async execute(
        id: string,
        workspaceId: string,
        user: PublicUser
    ): Promise<void> {
        const existing = await this.repository.findById(id);
        if (!existing || existing.workspaceId !== workspaceId) {
            throw new SavedViewNotFoundError(id);
        }
        this.access.assertOwned(existing, user);
        await this.repository.delete(id);
    }
}
