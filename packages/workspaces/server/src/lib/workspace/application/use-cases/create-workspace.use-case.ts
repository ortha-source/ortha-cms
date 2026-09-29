import { Inject, Injectable } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@orthacms/database';
import type { PublicUser } from '@orthacms/identity-server';
import { Workspace } from '../../domain/workspace';
import { Slug } from '../../domain/value-objects/slug';
import { WorkspaceColor } from '../../domain/value-objects/workspace-color';
import { SlugUniquenessService } from '../../domain/slug-uniqueness.service';
import {
    WORKSPACE_REPOSITORY,
    type WorkspaceRepository
} from '../../domain/workspace.repository';
import {
    MEMBER_PROVISIONER,
    type MemberProvisioner
} from '../ports/member-provisioner.port';
import { ContentCatalogReader } from '../content/content-catalog.reader';
import { resolveGrants } from '../content/content-selection';
import {
    SHARED_CONTENT_SOURCES,
    type SharedContentSources
} from '../ports/shared-content-sources.port';
import {
    InvalidSharedSourceError,
    UnknownContentTypeError
} from '../../domain/errors';
import type { GrantState } from '../../domain/workspace';
import type { SharedContentSelectionDto } from '../dto/create-workspace.dto';
import type { CreateWorkspaceDto } from '../dto/create-workspace.dto';

/**
 * Creates a workspace owned by the current user (linked as its first member),
 * plus the requested members and content grants — all in one unit of work. The
 * slug's format is enforced by the {@link Slug} value object and its uniqueness
 * by {@link SlugUniquenessService}; the `workspace.created` domain event is
 * drained to the outbox (carrying the actor), where the activity subscriber
 * turns it into the audit row.
 */
@Injectable()
export class CreateWorkspaceUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly slugUniqueness: SlugUniquenessService,
        private readonly catalog: ContentCatalogReader,
        @Inject(WORKSPACE_REPOSITORY)
        private readonly workspaces: WorkspaceRepository,
        @Inject(MEMBER_PROVISIONER)
        private readonly provisioner: MemberProvisioner,
        @Inject(SHARED_CONTENT_SOURCES)
        private readonly sources: SharedContentSources
    ) {}

    /**
     * Runs the create. Throws `SlugTakenError` (→ 409) when the slug is in use
     * and `InvalidSlugError` / `InvalidWorkspaceColorError` (→ 400) for a
     * malformed slug or color. A `content.sharedContent` item naming an
     * unknown slug throws `UnknownContentTypeError` (→ 400); one whose source
     * cannot serve it, `InvalidSharedSourceError` (→ 422). Returns the new
     * workspace id.
     */
    async execute(dto: CreateWorkspaceDto, actor: PublicUser): Promise<string> {
        const slug = Slug.create(dto.slug);
        const color = WorkspaceColor.create(dto.color);
        const shared = (dto.content.sharedContent ?? []).map((item) => ({
            item,
            kind: this.kindOf(item.slug)
        }));

        return this.uow.run(async () => {
            await this.slugUniqueness.assertAvailable(slug);

            const memberUserIds = await this.provisioner.resolve(dto.members);
            const grants: GrantState[] = resolveGrants(
                dto.content,
                this.catalog.knownSlugs()
            );
            for (const { item, kind } of shared) {
                await this.assertOffered(item, kind);
                grants.push({
                    kind,
                    slug: item.slug,
                    sourceWorkspaceId: item.sourceWorkspaceId
                });
            }

            const workspace = Workspace.create({
                name: dto.name,
                slug,
                description: dto.description,
                color,
                creatorUserId: actor.id,
                memberUserIds,
                grants
            });
            await this.workspaces.save(workspace);

            // Audit is derived downstream from the domain event by the activity
            // subscriber; the actor rides along on the event payload.
            await this.outbox.append(
                attachActor(workspace.pullEvents(), actor)
            );

            return workspace.id.value;
        });
    }

    /** The catalogue kind of `slug`, or {@link UnknownContentTypeError}. */
    private kindOf(slug: string) {
        const kind = this.catalog.resolveKind(slug);
        if (!kind) {
            throw new UnknownContentTypeError(slug);
        }
        return kind;
    }

    /**
     * Refuses a shared grant whose source is not a shared, active workspace
     * holding its own grant for the slug — the same rule the single-grant add
     * applies. A brand-new workspace cannot be anyone's source yet, so no
     * self-check is needed here beyond the aggregate's own.
     */
    private async assertOffered(
        item: SharedContentSelectionDto,
        kind: string
    ): Promise<void> {
        const offered = await this.sources.offeredKind(
            item.sourceWorkspaceId,
            item.slug
        );
        if (offered !== kind) {
            throw new InvalidSharedSourceError(
                item.sourceWorkspaceId,
                item.slug
            );
        }
    }
}
