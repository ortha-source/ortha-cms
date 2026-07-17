import { Inject, Injectable, Optional } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import {
    ACTIVITY_RECORDER,
    IDENTITY_ACTIVITY_KINDS,
    type ActivityRecorder,
    type PublicUser
} from '@ortha-cms/identity-server';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { WorkspaceColor } from '../../domain/value-objects/workspace-color';
import { WorkspaceNotFoundError } from '../../domain/errors';
import {
    WORKSPACE_REPOSITORY,
    type WorkspaceRepository
} from '../../domain/workspace.repository';
import type { WorkspaceProfilePatch } from '../../domain/workspace';
import type { UpdateWorkspaceDto } from '../dto/update-workspace.dto';

/**
 * Applies a partial profile edit (name / description / color) to a workspace.
 * A patch with no fields present is a no-op that still succeeds (the controller
 * returns the current view). Records `workspace.updated` in-band and drains the
 * domain event only when something actually changed. 404s an unknown workspace.
 */
@Injectable()
export class UpdateWorkspaceUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(WORKSPACE_REPOSITORY)
        private readonly workspaces: WorkspaceRepository,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /** Runs the update. Throws {@link WorkspaceNotFoundError} (→ 404). */
    async execute(
        actor: PublicUser,
        workspaceId: string,
        dto: UpdateWorkspaceDto
    ): Promise<void> {
        const id = WorkspaceId.create(workspaceId);

        // The changed field names, for the audit meta (mirrors the patch keys).
        const fields: string[] = [];
        const patch: WorkspaceProfilePatch = {};
        if (dto.name !== undefined) {
            patch.name = dto.name;
            fields.push('name');
        }
        if (dto.description !== undefined) {
            patch.description = dto.description;
            fields.push('description');
        }
        if (dto.color !== undefined) {
            patch.color = WorkspaceColor.create(dto.color);
            fields.push('color');
        }

        await this.uow.run(async () => {
            const workspace = await this.workspaces.findById(id);
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            if (!workspace.updateProfile(patch)) {
                return;
            }
            await this.workspaces.save(workspace);
            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_UPDATED,
                    subjectType: 'workspace',
                    subjectId: workspaceId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { fields }
                },
                this.uow.current()
            );
            await this.outbox.append(workspace.pullEvents());
        });
    }
}
