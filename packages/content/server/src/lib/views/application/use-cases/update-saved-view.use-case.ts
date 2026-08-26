import { Inject, Injectable } from '@nestjs/common';
import type { PublicUser } from '@orthacms/identity-server';
import { isUniqueViolation } from '@orthacms/utils-server';
import type {
    SavedView,
    SavedViewPayload,
    ViewVisibility
} from '../../domain/saved-view';
import {
    SAVED_VIEW_REPOSITORY,
    type SavedViewRepository
} from '../../domain/saved-view.repository';
import {
    SavedViewNameTakenError,
    SavedViewNotFoundError
} from '../../domain/errors';
import { SavedViewAccessService } from '../saved-view-access.service';
import { toSavedView } from '../queries/saved-views.query';

/** The fields `PATCH /api/views/:id` may change. */
export interface UpdateSavedViewInput {
    /** New display name. */
    name?: string;
    /** New visibility. */
    visibility?: ViewVisibility;
    /** New slice. */
    payload?: SavedViewPayload;
}

/** Renames, re-shares, or re-captures an existing view. */
@Injectable()
export class UpdateSavedViewUseCase {
    constructor(
        @Inject(SAVED_VIEW_REPOSITORY)
        private readonly repository: SavedViewRepository,
        private readonly access: SavedViewAccessService
    ) {}

    async execute(
        id: string,
        workspaceId: string,
        input: UpdateSavedViewInput,
        user: PublicUser
    ): Promise<SavedView> {
        const existing = await this.repository.findById(id);
        // The workspace check is part of the not-found decision, not a separate
        // 403: an id from another workspace must read exactly like an unknown
        // one, or the endpoint becomes a probe for views elsewhere.
        if (!existing || existing.workspaceId !== workspaceId) {
            throw new SavedViewNotFoundError(id);
        }
        this.access.assertOwned(existing, user);
        if (input.visibility !== undefined) {
            await this.access.assertCanUseVisibility(input.visibility, user);
        }

        // Every field is optional, so `{}` is a valid body — and it would reach
        // Drizzle as `.set({})`, which throws rather than updating nothing.
        // Answer the row unchanged instead: a patch that asks for no change has
        // already got what it asked for.
        const changes =
            input.name !== undefined ||
            input.visibility !== undefined ||
            input.payload !== undefined;
        if (!changes) {
            const currentDefault = await this.repository.findDefaultId(
                user.id,
                existing.scope
            );
            return toSavedView(existing, user.id, currentDefault);
        }

        let updated;
        try {
            updated = await this.repository.update(id, input);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new SavedViewNameTakenError(input.name ?? existing.name);
            }
            throw error;
        }
        const defaultId = await this.repository.findDefaultId(
            user.id,
            updated.scope
        );
        return toSavedView(updated, user.id, defaultId);
    }
}
