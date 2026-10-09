import { Inject, Injectable } from '@nestjs/common';
import type { PublicUser } from '@orthacms/identity-server';
import { attachActor, OutboxWriter, UnitOfWork } from '@orthacms/database';
import {
    SAVED_VIEW_EVENT_KINDS,
    savedViewEvent
} from '../../domain/events/saved-view-events';
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
    SavedViewLimitError,
    SavedViewNameTakenError
} from '../../domain/errors';
import { VIEW_MAX_PER_SCOPE } from '../../views.constants';
import { SavedViewAccessService } from '../saved-view-access.service';
import { toSavedView } from '../queries/saved-views.query';

/** Input for {@link CreateSavedViewUseCase}. */
export interface CreateSavedViewInput {
    /** The workspace the view belongs to. */
    workspaceId: string;
    /** The list it is over (`content:<typeName>`). */
    scope: string;
    /** Display name, already trimmed by the DTO. */
    name: string;
    /** Who may see it. */
    visibility: ViewVisibility;
    /** The slice it restores. */
    payload: SavedViewPayload;
    /** Whether to make it the caller's default for this scope. */
    makeDefault?: boolean;
}

/** Saves a new view for the calling user. */
@Injectable()
export class CreateSavedViewUseCase {
    constructor(
        @Inject(SAVED_VIEW_REPOSITORY)
        private readonly repository: SavedViewRepository,
        private readonly access: SavedViewAccessService,
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter
    ) {}

    async execute(
        input: CreateSavedViewInput,
        user: PublicUser
    ): Promise<SavedView> {
        await this.access.assertCanUseVisibility(input.visibility, user);

        // The unique index is the arbiter of the *name*: two concurrent saves
        // of the same name both pass a read-then-write check and one of them
        // has to lose at the constraint. Translate that loss into the same 409
        // a sequential duplicate gets.
        let created;
        try {
            created = await this.uow.run(async () => {
                // The *cap* has no constraint to arbitrate it, so it is counted
                // under a per-owner lock, in the transaction that inserts.
                // Counting first and inserting later let concurrent saves each
                // see room for one more and all commit.
                await this.repository.lockOwner(
                    input.workspaceId,
                    input.scope,
                    user.id
                );
                const held = await this.repository.countForOwner(
                    input.workspaceId,
                    input.scope,
                    user.id
                );
                if (held >= VIEW_MAX_PER_SCOPE) throw new SavedViewLimitError();

                const row = await this.repository.create({
                    workspaceId: input.workspaceId,
                    scope: input.scope,
                    ownerId: user.id,
                    visibility: input.visibility,
                    name: input.name,
                    payload: input.payload
                });
                await this.outbox.append(
                    attachActor(
                        [
                            savedViewEvent(
                                SAVED_VIEW_EVENT_KINDS.CREATED,
                                row.id,
                                {
                                    workspaceId: input.workspaceId,
                                    scope: input.scope,
                                    name: input.name,
                                    // The half that makes the row worth
                                    // keeping: a `workspace` view is shared
                                    // state everyone in the switcher sees.
                                    visibility: input.visibility
                                }
                            )
                        ],
                        { id: user.id, email: user.email ?? null }
                    )
                );
                return row;
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new SavedViewNameTakenError(input.name);
            }
            throw error;
        }

        if (input.makeDefault) {
            // Outside the run on purpose: a personal default raises no event
            // (see `saved-view-events.ts`), so it has nothing to commit with.
            await this.repository.setDefault(user.id, input.scope, created.id);
        }
        return toSavedView(
            created,
            user.id,
            input.makeDefault ? created.id : null
        );
    }
}
