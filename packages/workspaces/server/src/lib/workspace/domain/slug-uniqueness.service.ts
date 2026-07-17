import type { Slug } from './value-objects/slug';
import type { WorkspaceRepository } from './workspace.repository';
import { SlugTakenError } from './errors';

/**
 * Domain service enforcing the **cross-aggregate** rule that a workspace slug is
 * unique system-wide — an invariant no single {@link Workspace} can guard
 * alone. Reads through the repository port, so it stays framework- and
 * infrastructure-free; the application calls it before creating a workspace.
 */
export class SlugUniquenessService {
    constructor(private readonly workspaces: WorkspaceRepository) {}

    /**
     * Asserts `slug` is free, throwing {@link SlugTakenError} when another
     * workspace already holds it. The database's unique constraint is the
     * race-proof backstop; this gives the friendly up-front error.
     */
    async assertAvailable(slug: Slug): Promise<void> {
        if (await this.workspaces.existsBySlug(slug.value)) {
            throw new SlugTakenError(slug.value);
        }
    }
}
